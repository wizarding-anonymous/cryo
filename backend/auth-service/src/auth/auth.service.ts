import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { TokenService } from '../token/token.service';
import { SessionService } from '../session/session.service';
import { UserServiceClient } from '../common/http-client/user-service.client';
import { SecurityServiceClient } from '../common/http-client/security-service.client';
import { NotificationServiceClient } from '../common/http-client/notification-service.client';
import { EventBusService } from '../events/services/event-bus.service';
import { UserRegisteredEvent, UserLoggedInEvent, UserLoggedOutEvent, SecurityEventDto } from '../events/dto';
import { AuthSagaService } from '../saga/auth-saga.service';
import { SagaService } from '../saga/saga.service';
import { AsyncOperationsService } from '../common/async/async-operations.service';
import { AsyncMetricsService } from '../common/async/async-metrics.service';
import { WorkerProcessService } from '../common/async/worker-process.service';

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  user: Omit<User, 'password'>;
  access_token: string;
  refresh_token?: string;
  session_id?: string;
  expires_in?: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly maxSessionsPerUser: number;
  private readonly useSagaPattern: boolean;

  constructor(
    private readonly jwtService: JwtService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly userServiceClient: UserServiceClient,
    private readonly securityServiceClient: SecurityServiceClient,
    private readonly notificationServiceClient: NotificationServiceClient,
    private readonly eventBusService: EventBusService,
    private readonly configService: ConfigService,
    private readonly authSagaService: AuthSagaService,
    private readonly sagaService: SagaService,
    private readonly asyncOperations: AsyncOperationsService,
    private readonly metricsService: AsyncMetricsService,
    private readonly workerProcess: WorkerProcessService,
  ) {
    this.maxSessionsPerUser = this.configService.get<number>('MAX_SESSIONS_PER_USER', 5);
    this.useSagaPattern = this.configService.get<boolean>('USE_SAGA_PATTERN', true);
  }

  /**
   * Registers a new user using Saga pattern for transactional consistency.
   * ARCHITECTURAL FIX: Implements distributed transactions with compensation
   * 
   * @param registerDto - The registration data.
   * @param ipAddress - Client IP address for session tracking.
   * @param userAgent - Client user agent for session tracking.
   * @returns The newly created user and JWT tokens or saga ID for async processing.
   * @throws ConflictException if the email is already in use.
   */
  async register(
    registerDto: RegisterDto, 
    ipAddress: string = '::1', 
    userAgent: string = 'Unknown'
  ): Promise<AuthResponse> {
    const startTime = Date.now();
    
    try {
      // Execute critical path with optimized async operations
      const result = await this.asyncOperations.executeCriticalPath(
        async () => {
          if (this.useSagaPattern) {
            return await this.registerWithSaga(registerDto, ipAddress, userAgent);
          } else {
            return await this.registerLegacy(registerDto, ipAddress, userAgent);
          }
        },
        // Fallback to legacy method if saga fails
        async () => {
          this.logger.warn('Falling back to legacy registration method');
          return await this.registerLegacy(registerDto, ipAddress, userAgent);
        }
      );

      const duration = Date.now() - startTime;
      this.metricsService.recordAuthFlowMetric('register', duration, true, {
        useSaga: this.useSagaPattern,
        ipAddress,
        userAgent,
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.metricsService.recordAuthFlowMetric('register', duration, false, {
        error: error.message,
        useSaga: this.useSagaPattern,
        ipAddress,
        userAgent,
      });

      this.logger.error('Registration failed', {
        email: registerDto.email,
        error: error.message,
        duration,
        ipAddress,
      });

      throw error;
    }
  }

  /**
   * Registers a new user using Saga pattern for distributed transactions
   * Steps: validateUser → hashPassword → createUser → generateTokens → createSession → publishEvents
   * Each step has compensation logic to maintain consistency on failure
   */
  private async registerWithSaga(
    registerDto: RegisterDto,
    ipAddress: string,
    userAgent: string
  ): Promise<AuthResponse> {
    this.logger.log('Starting registration with Saga pattern', {
      email: registerDto.email,
      ipAddress,
      sagaEnabled: true
    });

    // Start the registration saga
    const sagaId = await this.authSagaService.executeRegistrationSaga(
      registerDto,
      ipAddress,
      userAgent
    );

    // Wait for saga completion (with timeout)
    const sagaResult = await this.authSagaService.waitForSagaCompletion(sagaId, 30000);

    if (!sagaResult.completed) {
      this.logger.error('Registration saga failed or timed out', {
        sagaId,
        status: sagaResult.status,
        error: sagaResult.error,
        email: registerDto.email
      });

      if (sagaResult.status === 'failed') {
        throw new InternalServerErrorException(
          sagaResult.error || 'Registration failed due to system error'
        );
      } else if (sagaResult.status === 'timeout') {
        throw new InternalServerErrorException(
          'Registration is taking longer than expected. Please try again.'
        );
      } else {
        throw new InternalServerErrorException('Registration failed');
      }
    }

    // Get the saga to extract results
    const saga = await this.sagaService.getSaga(sagaId);
    if (!saga || !saga.metadata) {
      throw new InternalServerErrorException('Unable to retrieve registration results');
    }

    // Since saga completed successfully, we need to get the actual results
    // In a production system, we'd store intermediate results in Redis
    // For now, we'll perform a final lookup to get the created user
    try {
      const createdUser = await this.userServiceClient.findByEmail(registerDto.email);
      if (!createdUser) {
        throw new InternalServerErrorException('User was created but cannot be found');
      }

      // Generate fresh tokens (saga tokens might be compensated)
      const tokens = await this.generateTokens(createdUser);

      // Get the most recent session for this user
      const sessions = await this.sessionService.getUserSessions(createdUser.id);
      const latestSession = sessions[0]; // Assuming sessions are ordered by creation time

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...userWithoutPassword } = createdUser;

      this.logger.log('Registration saga completed successfully', {
        sagaId,
        userId: createdUser.id,
        email: createdUser.email,
        sessionId: latestSession?.id
      });

      return {
        user: userWithoutPassword,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        session_id: latestSession?.id || 'unknown',
        expires_in: 3600, // 1 hour in seconds
      };

    } catch (error) {
      this.logger.error('Failed to retrieve registration results after saga completion', {
        sagaId,
        error: error.message,
        email: registerDto.email
      });
      throw new InternalServerErrorException('Registration completed but results unavailable');
    }
  }

  /**
   * Legacy registration method (without Saga pattern)
   * Kept for backward compatibility and gradual migration
   */
  private async registerLegacy(
    registerDto: RegisterDto,
    ipAddress: string,
    userAgent: string
  ): Promise<AuthResponse> {
    const { name, email, password } = registerDto;

    // Check if user already exists via User Service
    const existingUser = await this.userServiceClient.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    // Hash password using worker process for CPU-intensive operation
    // PERFORMANCE FIX: Offload CPU-intensive hashing to worker process
    const hashedPassword = await this.workerProcess.executeInWorker<string>(
      'hash-password',
      { password, saltRounds: 10 }
    );

    // Create user via User Service
    const newUser = await this.userServiceClient.createUser({
      name,
      email,
      password: hashedPassword,
    });

    // Generate tokens
    const tokens = await this.generateTokens(newUser);

    // Create session with metadata tracking
    // Requirements: 13.1, 13.2
    const session = await this.sessionService.createSession({
      userId: newUser.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      ipAddress,
      userAgent,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // Publish UserRegisteredEvent for event-driven processing using setImmediate for non-blocking execution
    // This will trigger security event logging and welcome email sending via event handlers
    // Requirements: 11.1, 11.4 - PERFORMANCE FIX: Use setImmediate instead of void calls
    setImmediate(() => {
      this.eventBusService.publishUserRegisteredEvent(new UserRegisteredEvent({
        userId: newUser.id,
        email: newUser.email,
        name: newUser.name,
        ipAddress,
        timestamp: new Date(),
      })).catch(error => {
        this.logger.error('Failed to publish user registered event', {
          userId: newUser.id,
          email: newUser.email,
          error: error.message,
        });
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = newUser;

    return {
      user: userWithoutPassword,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      session_id: session.id,
      expires_in: 3600, // 1 hour in seconds
    };
  }



  /**
   * Logs a user in using Saga pattern for transactional consistency.
   * ARCHITECTURAL FIX: Implements distributed transactions with compensation
   * 
   * @param user - The user object (typically from validateUser).
   * @param ipAddress - Client IP address for session tracking.
   * @param userAgent - Client user agent for session tracking.
   * @returns An object containing the access token and user info.
   */
  async login(
    user: Omit<User, 'password'>, 
    ipAddress: string = '::1', 
    userAgent: string = 'Unknown'
  ): Promise<AuthResponse> {
    const startTime = Date.now();
    
    try {
      // Execute critical path with optimized async operations
      const result = await this.asyncOperations.executeCriticalPath(
        async () => {
          if (this.useSagaPattern) {
            return await this.loginWithSaga(user, ipAddress, userAgent);
          } else {
            return await this.loginLegacy(user, ipAddress, userAgent);
          }
        },
        // Fallback to legacy method if saga fails
        async () => {
          this.logger.warn('Falling back to legacy login method', { userId: user.id });
          return await this.loginLegacy(user, ipAddress, userAgent);
        }
      );

      const duration = Date.now() - startTime;
      this.metricsService.recordAuthFlowMetric('login', duration, true, {
        userId: user.id,
        useSaga: this.useSagaPattern,
        ipAddress,
        userAgent,
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.metricsService.recordAuthFlowMetric('login', duration, false, {
        userId: user.id,
        error: error.message,
        useSaga: this.useSagaPattern,
        ipAddress,
        userAgent,
      });

      this.logger.error('Login failed', {
        userId: user.id,
        email: user.email,
        error: error.message,
        duration,
        ipAddress,
      });

      throw error;
    }
  }

  /**
   * Logs a user in using Saga pattern for distributed transactions
   * Steps: generateTokens → enforceSessionLimit → createSession → publishEvents
   * Each step has compensation logic to maintain consistency on failure
   */
  private async loginWithSaga(
    user: Omit<User, 'password'>,
    ipAddress: string,
    userAgent: string
  ): Promise<AuthResponse> {
    this.logger.log('Starting login with Saga pattern', {
      userId: user.id,
      email: user.email,
      ipAddress,
      sagaEnabled: true
    });

    // Start the login saga
    const sagaId = await this.authSagaService.executeLoginSaga(
      user,
      ipAddress,
      userAgent,
      this.maxSessionsPerUser
    );

    // Wait for saga completion (with timeout)
    const sagaResult = await this.authSagaService.waitForSagaCompletion(sagaId, 30000);

    if (!sagaResult.completed) {
      this.logger.error('Login saga failed or timed out', {
        sagaId,
        status: sagaResult.status,
        error: sagaResult.error,
        userId: user.id
      });

      if (sagaResult.status === 'failed') {
        throw new InternalServerErrorException(
          sagaResult.error || 'Login failed due to system error'
        );
      } else if (sagaResult.status === 'timeout') {
        throw new InternalServerErrorException(
          'Login is taking longer than expected. Please try again.'
        );
      } else {
        throw new InternalServerErrorException('Login failed');
      }
    }

    // Get the saga to extract results
    const saga = await this.sagaService.getSaga(sagaId);
    if (!saga || !saga.metadata) {
      throw new InternalServerErrorException('Unable to retrieve login results');
    }

    // Since saga completed successfully, get the most recent session
    try {
      const sessions = await this.sessionService.getUserSessions(user.id);
      const latestSession = sessions[0]; // Assuming sessions are ordered by creation time

      if (!latestSession) {
        throw new InternalServerErrorException('Session was created but cannot be found');
      }

      // Generate fresh tokens (saga tokens might be compensated)
      const tokens = await this.generateTokens(user as User);

      this.logger.log('Login saga completed successfully', {
        sagaId,
        userId: user.id,
        sessionId: latestSession.id,
        transactionalLogin: true
      });

      return {
        user,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        session_id: latestSession.id,
        expires_in: 3600, // 1 hour in seconds
      };

    } catch (error) {
      this.logger.error('Failed to retrieve login results after saga completion', {
        sagaId,
        error: error.message,
        userId: user.id
      });
      throw new InternalServerErrorException('Login completed but results unavailable');
    }
  }

  /**
   * Legacy login method (without Saga pattern)
   * Kept for backward compatibility and gradual migration
   */
  private async loginLegacy(
    user: Omit<User, 'password'>,
    ipAddress: string,
    userAgent: string
  ): Promise<AuthResponse> {
    // Generate tokens first
    const tokens = await this.generateTokens(user as User);

    // Atomically enforce session limit and create new session using distributed lock
    // This prevents race conditions during concurrent logins
    // Requirements: 13.3 - Race condition protection for session limiting
    const { session, removedSessionsCount } = await this.sessionService.createSessionWithLimit({
      userId: user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      ipAddress,
      userAgent,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    }, this.maxSessionsPerUser);

    // Log when old sessions are removed due to limit via event bus using setImmediate
    if (removedSessionsCount > 0) {
      setImmediate(() => {
        this.eventBusService.publishSecurityEvent(new SecurityEventDto({
          userId: user.id,
          type: 'login',
          ipAddress,
          userAgent,
          timestamp: new Date(),
          metadata: { 
            sessionLimitEnforced: true,
            removedSessionsCount,
            maxSessionsAllowed: this.maxSessionsPerUser,
            raceConditionProtected: true // Indicate that distributed locking was used
          }
        })).catch(error => {
          this.logger.error('Failed to publish session limit security event', {
            userId: user.id,
            error: error.message,
          });
        });
      });
    }

    // Publish UserLoggedInEvent for event-driven processing using setImmediate
    // This will trigger last login update and security event logging via event handlers
    // Requirements: 11.2, 11.4 - PERFORMANCE FIX: Use setImmediate instead of void calls
    setImmediate(() => {
      this.eventBusService.publishUserLoggedInEvent(new UserLoggedInEvent({
        userId: user.id,
        sessionId: session.id,
        ipAddress,
        userAgent,
        timestamp: new Date(),
      })).catch(error => {
        this.logger.error('Failed to publish user logged in event', {
          userId: user.id,
          sessionId: session.id,
          error: error.message,
        });
      });
    });

    return {
      user,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      session_id: session.id,
      expires_in: 3600, // 1 hour in seconds
    };
  }

  /**
   * Logs a user out by blacklisting their JWT tokens and invalidating session.
   * Enhanced with atomic operations and compensating transactions for consistency.
   * Updated to use event-driven architecture for security logging.
   * 
   * CRITICAL SECURITY FIX: Implements atomic logout with rollback mechanism
   * Order: blacklistToken first, then invalidateSession with compensation
   * 
   * @param accessToken The access token to blacklist.
   * @param userId The user ID for logging.
   * @param refreshToken Optional refresh token to blacklist.
   * @param ipAddress Client IP address for logging.
   */
  async logout(
    accessToken: string, 
    userId: string, 
    refreshToken?: string,
    ipAddress: string = '::1'
  ): Promise<void> {
    if (!accessToken) {
      throw new BadRequestException('Access token is required');
    }

    // Find session by access token first (before any modifications)
    // Requirements: 13.5
    const session = await this.sessionService.getSessionByAccessToken(accessToken);
    
    // Track blacklisted tokens for potential rollback
    const blacklistedTokens: string[] = [];
    
    try {
      // STEP 1: Blacklist access token first (critical security operation)
      // This ensures token is immediately invalid even if session invalidation fails
      await this.tokenService.blacklistToken(accessToken, userId, 'logout');
      blacklistedTokens.push(accessToken);
      
      // STEP 2: Blacklist refresh token if provided
      if (refreshToken) {
        await this.tokenService.blacklistToken(refreshToken, userId, 'logout');
        blacklistedTokens.push(refreshToken);
      }
      
      // STEP 3: Invalidate session (may fail, triggering compensation)
      if (session) {
        try {
          await this.sessionService.invalidateSession(session.id);
        } catch (sessionError) {
          this.logger.error('Session invalidation failed, performing rollback', {
            sessionId: session.id,
            userId,
            error: sessionError.message,
            blacklistedTokensCount: blacklistedTokens.length
          });
          
          // COMPENSATION: Remove tokens from blacklist to maintain consistency
          // If we can't invalidate the session, we shouldn't keep tokens blacklisted
          // as this creates inconsistent state where session is active but tokens are blocked
          await this.performLogoutRollback(blacklistedTokens, userId, session.id);
          
          // Re-throw the session error after compensation
          throw new InternalServerErrorException(
            'Logout failed: Unable to invalidate session. Please try again.'
          );
        }
      }
      
      // STEP 4: Publish success event only after all operations complete using setImmediate
      // Requirements: 11.3, 11.4 - PERFORMANCE FIX: Use setImmediate instead of void calls
      setImmediate(() => {
        this.eventBusService.publishUserLoggedOutEvent(new UserLoggedOutEvent({
          userId,
          sessionId: session?.id || 'unknown',
          ipAddress,
          reason: 'manual',
          timestamp: new Date(),
        })).catch(error => {
          this.logger.error('Failed to publish user logged out event', {
            userId,
            sessionId: session?.id,
            error: error.message,
          });
        });
      });
      
      this.logger.log('Atomic logout completed successfully', {
        userId,
        sessionId: session?.id,
        tokensBlacklisted: blacklistedTokens.length,
        atomicOperation: true
      });
      
    } catch (error) {
      // If error occurred after blacklisting but before session invalidation,
      // the rollback was already performed in the session invalidation catch block
      
      // Log the atomic operation failure
      this.logger.error('Atomic logout operation failed', {
        userId,
        sessionId: session?.id,
        error: error.message,
        blacklistedTokensCount: blacklistedTokens.length,
        atomicOperationFailed: true
      });
      
      // Re-throw the error (rollback already performed if needed)
      throw error;
    }
  }

  /**
   * Performs compensating rollback actions when logout fails
   * Removes tokens from blacklist to maintain consistency
   * 
   * @param blacklistedTokens List of tokens that were blacklisted
   * @param userId User ID for logging
   * @param sessionId Session ID for logging
   */
  private async performLogoutRollback(
    blacklistedTokens: string[], 
    userId: string, 
    sessionId: string
  ): Promise<void> {
    const rollbackErrors: string[] = [];
    
    // Attempt to remove each blacklisted token
    for (const token of blacklistedTokens) {
      try {
        await this.tokenService.removeFromBlacklist(token, userId);
        this.logger.log('Token removed from blacklist during rollback', {
          userId,
          sessionId,
          tokenType: token.length > 200 ? 'refresh' : 'access' // Rough heuristic
        });
      } catch (rollbackError) {
        const errorMsg = `Failed to remove token from blacklist during rollback: ${rollbackError.message}`;
        rollbackErrors.push(errorMsg);
        this.logger.error(errorMsg, {
          userId,
          sessionId,
          rollbackError: rollbackError.message
        });
      }
    }
    
    // Publish security event about the rollback using setImmediate
    setImmediate(() => {
      this.eventBusService.publishSecurityEvent(new SecurityEventDto({
        userId,
        type: 'logout_rollback',
        ipAddress: '::1', // Default since we don't have it in rollback context
        metadata: {
          sessionId,
          rollbackReason: 'session_invalidation_failed',
          tokensRolledBack: blacklistedTokens.length,
          rollbackErrors: rollbackErrors.length,
          rollbackErrorMessages: rollbackErrors,
          compensatingTransactionExecuted: true,
          consistencyMaintained: rollbackErrors.length === 0
        },
        timestamp: new Date(),
      })).catch(error => {
        this.logger.error('Failed to publish logout rollback security event', {
          userId,
          sessionId,
          error: error.message,
        });
      });
    });
    
    if (rollbackErrors.length > 0) {
      this.logger.error('Partial rollback failure - manual intervention may be required', {
        userId,
        sessionId,
        rollbackErrors,
        criticalInconsistency: true
      });
    }
  }

  /**
   * Refreshes access token using refresh token.
   * Implements refresh token validation, new access token generation, and token rotation.
   * @param refreshToken - The refresh token.
   * @returns New access token and new refresh token (rotation).
   * Requirements: 5.7, 4.4
   */
  async refreshToken(refreshToken: string): Promise<{ 
    access_token: string; 
    refresh_token: string;
    expires_in: number;
  }> {
    try {
      // Validate refresh token using TokenService
      const validation = await this.tokenService.validateRefreshToken(refreshToken);
      if (!validation.valid || !validation.payload) {
        throw new UnauthorizedException(validation.reason || 'Invalid refresh token');
      }

      // Verify user still exists and is active
      const user = await this.userServiceClient.findById(validation.payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found or deleted');
      }

      // Use TokenService to handle refresh token rotation
      const newTokens = await this.tokenService.refreshTokenWithRotation(
        refreshToken,
        user.id
      );

      // Log security event for token refresh (async) - PERFORMANCE FIX: Use setImmediate instead of void calls
      // Requirements: 6.1, 6.2, 6.3 - Log authentication events to Security Service
      setImmediate(() => {
        this.securityServiceClient.logTokenRefresh(
          user.id,
          '::1', // TODO: Get real IP from request context
          { 
            tokenRotated: true,
            oldTokenBlacklisted: true
          }
        ).catch(error => {
          this.logger.error('Failed to log token refresh security event', {
            userId: user.id,
            error: error.message,
          });
        });
      });

      return { 
        access_token: newTokens.accessToken,
        refresh_token: newTokens.refreshToken, // Return new refresh token (rotation)
        expires_in: newTokens.expiresIn
      };
    } catch (error) {
      // Re-throw UnauthorizedException as-is
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      // Handle specific token errors
      if (error.message?.includes('Invalid refresh token') || 
          error.message?.includes('expired') ||
          error.message?.includes('blacklisted')) {
        throw new UnauthorizedException(error.message);
      }
      
      // Generic error for unexpected issues
      throw new UnauthorizedException('Unable to refresh token');
    }
  }

  /**
   * Validates JWT token for other services.
   * @param token - JWT token to validate.
   * @returns Validation result with payload if valid.
   */
  async validateToken(token: string): Promise<{ valid: boolean; payload?: JwtPayload }> {
    try {
      // Verify token signature and expiration
      const payload = this.jwtService.verify(token) as JwtPayload;
      
      // Check if token is blacklisted
      const isBlacklisted = await this.tokenService.isTokenBlacklisted(token);
      if (isBlacklisted) {
        return { valid: false };
      }

      // Check if user still exists and is not deleted
      const user = await this.userServiceClient.findById(payload.sub);
      if (!user) {
        return { valid: false };
      }

      return { valid: true, payload };
    } catch (error) {
      return { valid: false };
    }
  }

  /**
   * Validate user credentials
   * @param email User email
   * @param password User password
   * @returns User object (without password) if credentials are valid, null otherwise
   */
  async validateUser(email: string, password: string): Promise<Omit<User, 'password'> | null> {
    try {
      // Find user by email
      const user = await this.userServiceClient.findByEmail(email);
      if (!user) {
        return null;
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return null;
      }

      // Return user without password
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...result } = user;
      return result;
    } catch (error) {
      this.logger.error('Error validating user credentials', {
        email,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Check if a JWT token is blacklisted
   * @param token JWT token to check
   * @returns true if token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    return this.tokenService.isTokenBlacklisted(token);
  }

  /**
   * Generates JWT access and refresh tokens for a user.
   * @param user - The user to generate tokens for.
   * @returns An object with the accessToken and refreshToken.
   */
  private async generateTokens(user: User): Promise<{ 
    accessToken: string; 
    refreshToken: string; 
  }> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, { expiresIn: '7d' }), // Refresh token valid for 7 days
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Invalidate all sessions for a user (for security events)
   * Requirements: 13.6
   * @param userId The user ID whose sessions to invalidate.
   * @param reason The reason for invalidation (e.g., 'security_breach', 'password_change').
   * @param ipAddress Client IP address for logging.
   */
  async invalidateAllUserSessions(
    userId: string, 
    reason: string = 'security_event',
    ipAddress: string = '::1'
  ): Promise<void> {
    // Invalidate all user sessions and get count
    const invalidatedCount = await this.sessionService.invalidateAllUserSessions(userId, reason);

    // Blacklist all tokens for the user
    await this.tokenService.blacklistAllUserTokens(userId);

    // Publish events for all sessions invalidation using setImmediate for parallel execution
    // Requirements: 11.3, 11.4 - PERFORMANCE FIX: Use setImmediate instead of void calls
    setImmediate(() => {
      // Execute both events in parallel for better performance
      const events = [
        () => this.eventBusService.publishUserLoggedOutEvent(new UserLoggedOutEvent({
          userId,
          sessionId: 'all_sessions',
          ipAddress,
          reason: 'security',
          timestamp: new Date(),
        })),
        () => this.eventBusService.publishSecurityEvent(new SecurityEventDto({
          userId,
          type: 'all_sessions_invalidated',
          ipAddress,
          metadata: { 
            reason,
            sessionsInvalidated: invalidatedCount,
            allSessionsInvalidated: true
          },
          timestamp: new Date(),
        })),
      ];

      this.asyncOperations.executeParallel(events, 2).catch(error => {
        this.logger.error('Failed to publish all sessions invalidation events', {
          userId,
          reason,
          error: error.message,
        });
      });
    });
  }

  /**
   * Invalidate sessions for specific security events
   * Requirements: 13.5, 13.6
   * @param userId The user ID whose sessions to invalidate.
   * @param securityEventType The type of security event.
   * @param ipAddress Client IP address for logging.
   * @param excludeCurrentSession Whether to exclude the current session from invalidation.
   */
  async invalidateSessionsForSecurityEvent(
    userId: string,
    securityEventType: 'password_change' | 'suspicious_activity' | 'account_compromise' | 'admin_action',
    ipAddress: string = '::1',
    excludeCurrentSession?: string
  ): Promise<void> {
    // Use the enhanced session service method
    const result = await this.sessionService.invalidateSessionsForSecurityEvent(
      userId,
      securityEventType,
      excludeCurrentSession
    );

    // Blacklist all tokens for the user (except current session if excluded)
    if (excludeCurrentSession) {
      // For password changes, we might want to keep the current session active
      // but blacklist other tokens - this would require more sophisticated token management
      await this.tokenService.blacklistAllUserTokens(userId);
    } else {
      await this.tokenService.blacklistAllUserTokens(userId);
    }

    // Publish events for security session invalidation using setImmediate for parallel execution
    // Requirements: 11.3, 11.4 - PERFORMANCE FIX: Use setImmediate instead of void calls
    setImmediate(() => {
      // Execute both events in parallel for better performance
      const events = [
        () => this.eventBusService.publishUserLoggedOutEvent(new UserLoggedOutEvent({
          userId,
          sessionId: excludeCurrentSession || 'multiple_sessions',
          ipAddress,
          reason: 'security',
          timestamp: new Date(),
        })),
        () => this.eventBusService.publishSecurityEvent(new SecurityEventDto({
          userId,
          type: 'security_session_invalidation',
          ipAddress,
          metadata: { 
            securityEventType,
            invalidatedCount: result.invalidatedCount,
            remainingCount: result.remainingCount,
            excludedCurrentSession: !!excludeCurrentSession,
            securityEventTriggered: true
          },
          timestamp: new Date(),
        })),
      ];

      this.asyncOperations.executeParallel(events, 2).catch(error => {
        this.logger.error('Failed to publish security session invalidation events', {
          userId,
          securityEventType,
          error: error.message,
        });
      });
    });
  }

  /**
   * Get user session information for management
   * Requirements: 13.3
   * @param userId The user ID to get sessions for.
   * @returns Array of session metadata.
   */
  async getUserSessions(userId: string) {
    return this.sessionService.getUserSessions(userId);
  }

  /**
   * Get session statistics for monitoring
   * Requirements: 13.2, 13.4, 13.7
   */
  async getSessionStats() {
    return this.sessionService.getSessionStats();
  }

  /**
   * Get concurrent session information for a user
   * Requirements: 13.3
   * @param userId The user ID to get session info for.
   */
  async getConcurrentSessionInfo(userId: string) {
    return this.sessionService.getConcurrentSessionInfo(userId, this.maxSessionsPerUser);
  }

  /**
   * Get session by access token
   * @param accessToken The access token to find session for.
   */
  async getSessionByAccessToken(accessToken: string) {
    return this.sessionService.getSessionByAccessToken(accessToken);
  }

  /**
   * Invalidate a specific session for a user
   * Requirements: 13.5
   * @param sessionId The session ID to invalidate.
   * @param userId The user ID (for security verification).
   */
  async invalidateSpecificSession(sessionId: string, userId: string): Promise<void> {
    // Get session to verify it belongs to the user and get token info
    const session = await this.sessionService.getSession(sessionId);
    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Session not found or access denied');
    }

    // Invalidate the session
    await this.sessionService.invalidateSession(sessionId);

    // Blacklist the tokens associated with this session
    if (session.id) {
      // Note: We would need to store token info in session to blacklist them
      // For now, we'll just invalidate the session
    }
  }

  /**
   * Log failed login attempt and detect suspicious activity
   * Requirements: 6.2, 6.3 - Log authentication events to Security Service
   * Requirements: 11.3, 11.4 - Add suspicious activity detection via events
   * @param email The email used in failed login attempt
   * @param ipAddress Client IP address
   * @param reason Reason for login failure
   * @param metadata Additional metadata
   */
  async logFailedLoginAttempt(
    email: string,
    ipAddress: string,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Get user ID for suspicious activity detection
    let userId: string | null = null;
    try {
      const user = await this.userServiceClient.findByEmail(email);
      userId = user?.id || null;
    } catch (error) {
      // Continue without user ID if user service is unavailable
    }

    // Publish security event for failed login attempt using setImmediate
    setImmediate(() => {
      this.eventBusService.publishSecurityEvent(new SecurityEventDto({
        userId: userId || 'unknown',
        type: 'failed_login',
        ipAddress,
        metadata: {
          email,
          reason,
          userAgent: metadata?.userAgent,
          ...metadata
        },
        timestamp: new Date(),
      })).catch(error => {
        this.logger.error('Failed to publish failed login security event', {
          email,
          userId,
          error: error.message,
        });
      });
    });

    // Check for suspicious activity patterns
    await this.detectSuspiciousActivity(email, userId, ipAddress, metadata);

    // Send security alert for failed login attempts using setImmediate
    // This helps notify users of potential unauthorized access attempts
    if (userId) {
      setImmediate(() => {
        this.notificationServiceClient.sendMultipleFailedAttemptsAlert(
          email,
          1, // Single attempt for now - could be enhanced to track multiple attempts
          ipAddress
        ).catch(error => {
          this.logger.error('Failed to send multiple failed attempts alert', {
            userId,
            email,
            ipAddress,
            error: error.message,
          });
        });
      });
    }
  }

  /**
   * Detect suspicious activity patterns and trigger security events
   * Requirements: 11.3, 11.4 - Add suspicious activity detection via events
   * @param email The email involved in the activity
   * @param userId The user ID (if known)
   * @param ipAddress Client IP address
   * @param metadata Additional context metadata
   */
  private async detectSuspiciousActivity(
    email: string,
    userId: string | null,
    ipAddress: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Check for multiple failed attempts from same IP
      const suspiciousPatterns = await this.analyzeSuspiciousPatterns(email, ipAddress, metadata);

      if (suspiciousPatterns.length > 0) {
        // Publish suspicious activity event using setImmediate
        setImmediate(() => {
          this.eventBusService.publishSecurityEvent(new SecurityEventDto({
            userId: userId || 'unknown',
            type: 'suspicious_activity',
            ipAddress,
            metadata: {
              email,
              patterns: suspiciousPatterns,
              detectionTimestamp: new Date(),
              userAgent: metadata?.userAgent,
              ...metadata
            },
            timestamp: new Date(),
          })).catch(error => {
            this.logger.error('Failed to publish suspicious activity security event', {
              email,
              userId,
              ipAddress,
              error: error.message,
            });
          });
        });

        // If we have a user ID and activity is severe, invalidate sessions
        if (userId && suspiciousPatterns.some(p => p.severity === 'high')) {
          await this.invalidateSessionsForSecurityEvent(
            userId,
            'suspicious_activity',
            ipAddress
          );
        }

        // Send security alert notification using setImmediate
        if (userId) {
          setImmediate(() => {
            this.notificationServiceClient.sendSecurityAlert(
              userId,
              email,
              'suspicious_login_activity',
              {
                ipAddress,
                patterns: suspiciousPatterns,
                timestamp: new Date(),
              }
            ).catch(error => {
              this.logger.error('Failed to send suspicious activity security alert', {
                userId,
                email,
                ipAddress,
                error: error.message,
              });
            });
          });
        }
      }
    } catch (error) {
      // Log error but don't fail the main authentication flow
      console.error('Error detecting suspicious activity:', error);
    }
  }

  /**
   * Analyze patterns to detect suspicious activity
   * @param email The email being analyzed
   * @param ipAddress The IP address being analyzed
   * @param metadata Additional context
   * @returns Array of detected suspicious patterns
   */
  private async analyzeSuspiciousPatterns(
    email: string,
    ipAddress: string,
    metadata?: Record<string, any>
  ): Promise<Array<{ type: string; severity: 'low' | 'medium' | 'high'; description: string }>> {
    const patterns: Array<{ type: string; severity: 'low' | 'medium' | 'high'; description: string }> = [];

    // Pattern 1: Multiple failed attempts from same IP in short time
    // This would typically query a database of recent login attempts
    // For now, we'll simulate the detection logic
    const recentFailedAttempts = await this.getRecentFailedAttempts(ipAddress, email);
    
    if (recentFailedAttempts >= 5) {
      patterns.push({
        type: 'multiple_failed_attempts',
        severity: 'high',
        description: `${recentFailedAttempts} failed login attempts from IP ${ipAddress} in the last 15 minutes`
      });
    } else if (recentFailedAttempts >= 3) {
      patterns.push({
        type: 'multiple_failed_attempts',
        severity: 'medium',
        description: `${recentFailedAttempts} failed login attempts from IP ${ipAddress} in the last 15 minutes`
      });
    }

    // Pattern 2: Unusual user agent or suspicious characteristics
    const userAgent = metadata?.userAgent;
    if (userAgent && this.isUserAgentSuspicious(userAgent)) {
      patterns.push({
        type: 'suspicious_user_agent',
        severity: 'medium',
        description: `Suspicious user agent detected: ${userAgent}`
      });
    }

    // Pattern 3: Geographic anomaly (would require IP geolocation)
    // This is a placeholder for future implementation
    if (await this.isGeographicAnomalyDetected(ipAddress, email)) {
      patterns.push({
        type: 'geographic_anomaly',
        severity: 'medium',
        description: `Login attempt from unusual geographic location: ${ipAddress}`
      });
    }

    // Pattern 4: Rapid successive attempts (brute force)
    if (await this.isBruteForceDetected(ipAddress, email)) {
      patterns.push({
        type: 'brute_force_attack',
        severity: 'high',
        description: `Rapid successive login attempts detected from ${ipAddress}`
      });
    }

    return patterns;
  }

  /**
   * Get count of recent failed attempts for an IP/email combination
   * This would typically query the login_attempts table
   */
  private async getRecentFailedAttempts(_ipAddress: string, _email: string): Promise<number> {
    // TODO: Implement actual database query to login_attempts table
    // For now, return a simulated count
    // In real implementation, this would query:
    // SELECT COUNT(*) FROM login_attempts 
    // WHERE (ip_address = ? OR email = ?) 
    // AND successful = false 
    // AND attempted_at > NOW() - INTERVAL 15 MINUTE
    return 0; // Placeholder
  }

  /**
   * Check if user agent appears suspicious
   */
  private isUserAgentSuspicious(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /curl/i,
      /wget/i,
      /python/i,
      /script/i,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Detect geographic anomalies (placeholder)
   */
  private async isGeographicAnomalyDetected(_ipAddress: string, _email: string): Promise<boolean> {
    // TODO: Implement IP geolocation and user's typical locations
    // This would compare current IP location with user's historical login locations
    return false; // Placeholder
  }

  /**
   * Detect brute force attack patterns (placeholder)
   */
  private async isBruteForceDetected(_ipAddress: string, _email: string): Promise<boolean> {
    // TODO: Implement rapid attempt detection
    // This would check for multiple attempts in very short time periods (seconds)
    return false; // Placeholder
  }

  /**
   * Compares a plain text password with a hash to see if they match using worker process.
   * PERFORMANCE FIX: Offload CPU-intensive comparison to worker process
   * @param password The plain text password.
   * @param hash The hashed password to compare against.
   * @returns A promise that resolves to true if they match, false otherwise.
   */
  private async comparePassword(password: string, hash: string): Promise<boolean> {
    return this.workerProcess.executeInWorker<boolean>(
      'compare-password',
      { password, hash }
    );
  }
}