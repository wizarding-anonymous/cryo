import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
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
  private readonly maxSessionsPerUser: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly userServiceClient: UserServiceClient,
    private readonly securityServiceClient: SecurityServiceClient,
    private readonly notificationServiceClient: NotificationServiceClient,
    private readonly eventBusService: EventBusService,
    private readonly configService: ConfigService,
  ) {
    this.maxSessionsPerUser = this.configService.get<number>('MAX_SESSIONS_PER_USER', 5);
  }

  /**
   * Registers a new user.
   * @param registerDto - The registration data.
   * @param ipAddress - Client IP address for session tracking.
   * @param userAgent - Client user agent for session tracking.
   * @returns The newly created user and JWT tokens.
   * @throws ConflictException if the email is already in use.
   */
  async register(
    registerDto: RegisterDto, 
    ipAddress: string = '::1', 
    userAgent: string = 'Unknown'
  ): Promise<AuthResponse> {
    const { name, email, password } = registerDto;

    // Check if user already exists via User Service
    const existingUser = await this.userServiceClient.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

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

    // Publish UserRegisteredEvent for event-driven processing
    // This will trigger security event logging and welcome email sending via event handlers
    // Requirements: 11.1, 11.4
    void this.eventBusService.publishUserRegisteredEvent(new UserRegisteredEvent({
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      ipAddress,
      timestamp: new Date(),
    }));

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
   * Validates a user based on email and password.
   * @param email - The user's email.
   * @param password - The user's plain text password.
   * @returns The user object (without password) if validation is successful, otherwise null.
   */
  async validateUser(email: string, password: string): Promise<Omit<User, 'password'> | null> {
    try {
      // Get user from User Service
      const user = await this.userServiceClient.findByEmail(email);
      if (!user) {
        return null;
      }

      // Validate password
      const isPasswordValid = await this.comparePassword(password, user.password);
      if (!isPasswordValid) {
        return null;
      }

      // Return user without password
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...result } = user;
      return result;
    } catch (error) {
      return null;
    }
  }

  /**
   * Logs a user in and returns JWT tokens and user info.
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

    // Log when old sessions are removed due to limit via event bus
    if (removedSessionsCount > 0) {
      void this.eventBusService.publishSecurityEvent(new SecurityEventDto({
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
      }));
    }

    // Publish UserLoggedInEvent for event-driven processing
    // This will trigger last login update and security event logging via event handlers
    // Requirements: 11.2, 11.4
    void this.eventBusService.publishUserLoggedInEvent(new UserLoggedInEvent({
      userId: user.id,
      sessionId: session.id,
      ipAddress,
      userAgent,
      timestamp: new Date(),
    }));

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
   * Enhanced to support blacklisting both access and refresh tokens.
   * Updated to use event-driven architecture for security logging.
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

    // Find and invalidate session by access token
    // Requirements: 13.5
    const session = await this.sessionService.getSessionByAccessToken(accessToken);
    if (session) {
      await this.sessionService.invalidateSession(session.id);
    }

    // Blacklist the access token
    await this.tokenService.blacklistToken(accessToken, userId, 'logout');

    // Blacklist refresh token if provided
    if (refreshToken) {
      await this.tokenService.blacklistToken(refreshToken, userId, 'logout');
    }

    // Publish UserLoggedOutEvent for event-driven processing
    // This will trigger security event logging via event handlers
    // Requirements: 11.3, 11.4
    void this.eventBusService.publishUserLoggedOutEvent(new UserLoggedOutEvent({
      userId,
      sessionId: session?.id || 'unknown',
      ipAddress,
      reason: 'manual',
      timestamp: new Date(),
    }));
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

      // Log security event for token refresh (async)
      // Requirements: 6.1, 6.2, 6.3 - Log authentication events to Security Service
      void this.securityServiceClient.logTokenRefresh(
        user.id,
        '::1', // TODO: Get real IP from request context
        { 
          tokenRotated: true,
          oldTokenBlacklisted: true
        }
      );

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

    // Publish UserLoggedOutEvent for event-driven security logging
    // Requirements: 11.3, 11.4
    void this.eventBusService.publishUserLoggedOutEvent(new UserLoggedOutEvent({
      userId,
      sessionId: 'all_sessions',
      ipAddress,
      reason: 'security',
      timestamp: new Date(),
    }));

    // Publish additional security event for all sessions invalidation
    void this.eventBusService.publishSecurityEvent(new SecurityEventDto({
      userId,
      type: 'all_sessions_invalidated',
      ipAddress,
      metadata: { 
        reason,
        sessionsInvalidated: invalidatedCount,
        allSessionsInvalidated: true
      },
      timestamp: new Date(),
    }));
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

    // Publish UserLoggedOutEvent for event-driven security logging
    // Requirements: 11.3, 11.4
    void this.eventBusService.publishUserLoggedOutEvent(new UserLoggedOutEvent({
      userId,
      sessionId: excludeCurrentSession || 'multiple_sessions',
      ipAddress,
      reason: 'security',
      timestamp: new Date(),
    }));

    // Publish additional security event for security-triggered session invalidation
    void this.eventBusService.publishSecurityEvent(new SecurityEventDto({
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
    }));
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

    // Publish security event for failed login attempt
    void this.eventBusService.publishSecurityEvent(new SecurityEventDto({
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
    }));

    // Check for suspicious activity patterns
    await this.detectSuspiciousActivity(email, userId, ipAddress, metadata);

    // Send security alert for failed login attempts (async)
    // This helps notify users of potential unauthorized access attempts
    if (userId) {
      void this.notificationServiceClient.sendMultipleFailedAttemptsAlert(
        email,
        1, // Single attempt for now - could be enhanced to track multiple attempts
        ipAddress
      );
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
        // Publish suspicious activity event
        void this.eventBusService.publishSecurityEvent(new SecurityEventDto({
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
        }));

        // If we have a user ID and activity is severe, invalidate sessions
        if (userId && suspiciousPatterns.some(p => p.severity === 'high')) {
          await this.invalidateSessionsForSecurityEvent(
            userId,
            'suspicious_activity',
            ipAddress
          );
        }

        // Send security alert notification
        if (userId) {
          void this.notificationServiceClient.sendSecurityAlert(
            userId,
            email,
            'suspicious_login_activity',
            {
              ipAddress,
              patterns: suspiciousPatterns,
              timestamp: new Date(),
            }
          );
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
   * Compares a plain text password with a hash to see if they match.
   * @param password The plain text password.
   * @param hash The hashed password to compare against.
   * @returns A promise that resolves to true if they match, false otherwise.
   */
  private async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}