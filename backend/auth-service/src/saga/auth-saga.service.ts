import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { SagaService, SagaStep } from './saga.service';
import { UserServiceClient } from '../common/http-client/user-service.client';
import { TokenService } from '../token/token.service';
import { SessionService } from '../session/session.service';
import { EventBusService } from '../events/services/event-bus.service';
import { RegisterDto } from '../auth/dto/register.dto';
import { UserRegisteredEvent, UserLoggedInEvent, SecurityEventDto } from '../events/dto';
import * as bcrypt from 'bcrypt';

export interface RegistrationSagaData {
  registerDto: RegisterDto;
  ipAddress: string;
  userAgent: string;
  hashedPassword?: string;
  createdUser?: any;
  generatedTokens?: { accessToken: string; refreshToken: string };
  createdSession?: any;
}

export interface LoginSagaData {
  user: any;
  ipAddress: string;
  userAgent: string;
  maxSessionsPerUser: number;
  generatedTokens?: { accessToken: string; refreshToken: string };
  createdSession?: any;
  removedSessionsCount?: number;
}

@Injectable()
export class AuthSagaService {
  private readonly logger = new Logger(AuthSagaService.name);

  constructor(
    private readonly sagaService: SagaService,
    private readonly userServiceClient: UserServiceClient,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly eventBusService: EventBusService,
  ) {}

  /**
   * Executes user registration as a saga transaction
   * Steps: validateUser → hashPassword → createUser → generateTokens → createSession → publishEvents
   * @param registerDto Registration data
   * @param ipAddress Client IP address
   * @param userAgent Client user agent
   * @returns Saga ID for tracking
   */
  async executeRegistrationSaga(
    registerDto: RegisterDto,
    ipAddress: string,
    userAgent: string
  ): Promise<string> {
    const sagaData: RegistrationSagaData = {
      registerDto,
      ipAddress,
      userAgent,
    };

    const steps: Omit<SagaStep, 'id'>[] = [
      {
        name: 'validateUserDoesNotExist',
        execute: async () => {
          this.logger.log('Validating user does not exist', { email: registerDto.email });
          
          const existingUser = await this.userServiceClient.findByEmail(registerDto.email);
          if (existingUser) {
            throw new ConflictException('Пользователь с таким email уже существует');
          }
          
          return { validated: true };
        },
        compensate: async () => {
          // No compensation needed for validation step
          this.logger.log('No compensation needed for user validation');
        },
        maxRetries: 2,
        timeout: 5000,
      },

      {
        name: 'hashPassword',
        execute: async () => {
          this.logger.log('Hashing password');
          
          sagaData.hashedPassword = await bcrypt.hash(registerDto.password, 10);
          
          return { hashedPassword: sagaData.hashedPassword };
        },
        compensate: async () => {
          // No compensation needed for password hashing
          this.logger.log('No compensation needed for password hashing');
          sagaData.hashedPassword = undefined;
        },
        maxRetries: 1,
        timeout: 3000,
      },

      {
        name: 'createUser',
        execute: async () => {
          this.logger.log('Creating user in User Service', { email: registerDto.email });
          
          sagaData.createdUser = await this.userServiceClient.createUser({
            name: registerDto.name,
            email: registerDto.email,
            password: sagaData.hashedPassword!,
          });
          
          return { user: sagaData.createdUser };
        },
        compensate: async () => {
          if (sagaData.createdUser) {
            this.logger.log('Compensating: Deleting created user', { 
              userId: sagaData.createdUser.id 
            });
            
            try {
              // Note: This requires User Service to have a delete endpoint
              // await this.userServiceClient.deleteUser(sagaData.createdUser.id);
              
              // For now, we'll mark the user as deleted or inactive
              // This is a design decision - we might want to keep user data for audit
              this.logger.warn('User deletion not implemented - user remains in system', {
                userId: sagaData.createdUser.id,
                email: sagaData.createdUser.email,
                compensationReason: 'registration_saga_failed'
              });
              
            } catch (error) {
              this.logger.error('Failed to compensate user creation', {
                userId: sagaData.createdUser.id,
                error: error.message,
              });
            }
            
            sagaData.createdUser = undefined;
          }
        },
        maxRetries: 3,
        timeout: 10000,
      },

      {
        name: 'generateTokens',
        execute: async () => {
          if (!sagaData.createdUser) {
            throw new Error('User must be created before generating tokens');
          }
          
          this.logger.log('Generating JWT tokens', { userId: sagaData.createdUser.id });
          
          const tokenResult = await this.tokenService.generateTokens(sagaData.createdUser);
          sagaData.generatedTokens = {
            accessToken: tokenResult.accessToken,
            refreshToken: tokenResult.refreshToken,
          };
          
          return { tokens: sagaData.generatedTokens };
        },
        compensate: async () => {
          if (sagaData.generatedTokens) {
            this.logger.log('Compensating: Blacklisting generated tokens', {
              userId: sagaData.createdUser?.id
            });
            
            try {
              // Blacklist the generated tokens to prevent their use
              await this.tokenService.blacklistToken(
                sagaData.generatedTokens.accessToken,
                sagaData.createdUser.id,
                'admin'
              );
              
              await this.tokenService.blacklistToken(
                sagaData.generatedTokens.refreshToken,
                sagaData.createdUser.id,
                'admin'
              );
              
            } catch (error) {
              this.logger.error('Failed to compensate token generation', {
                userId: sagaData.createdUser?.id,
                error: error.message,
              });
            }
            
            sagaData.generatedTokens = undefined;
          }
        },
        maxRetries: 2,
        timeout: 5000,
      },

      {
        name: 'createSession',
        execute: async () => {
          if (!sagaData.createdUser || !sagaData.generatedTokens) {
            throw new Error('User and tokens must be created before creating session');
          }
          
          this.logger.log('Creating user session', { userId: sagaData.createdUser.id });
          
          sagaData.createdSession = await this.sessionService.createSession({
            userId: sagaData.createdUser.id,
            accessToken: sagaData.generatedTokens.accessToken,
            refreshToken: sagaData.generatedTokens.refreshToken,
            ipAddress,
            userAgent,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          });
          
          return { session: sagaData.createdSession };
        },
        compensate: async () => {
          if (sagaData.createdSession) {
            this.logger.log('Compensating: Invalidating created session', {
              sessionId: sagaData.createdSession.id,
              userId: sagaData.createdUser?.id
            });
            
            try {
              await this.sessionService.invalidateSession(sagaData.createdSession.id);
            } catch (error) {
              this.logger.error('Failed to compensate session creation', {
                sessionId: sagaData.createdSession.id,
                error: error.message,
              });
            }
            
            sagaData.createdSession = undefined;
          }
        },
        maxRetries: 2,
        timeout: 5000,
      },

      {
        name: 'publishRegistrationEvents',
        execute: async () => {
          if (!sagaData.createdUser) {
            throw new Error('User must be created before publishing events');
          }
          
          this.logger.log('Publishing registration events', { userId: sagaData.createdUser.id });
          
          // Publish UserRegisteredEvent for event-driven processing
          await this.eventBusService.publishUserRegisteredEvent(new UserRegisteredEvent({
            userId: sagaData.createdUser.id,
            email: sagaData.createdUser.email,
            name: sagaData.createdUser.name,
            ipAddress,
            timestamp: new Date(),
          }));
          
          return { eventsPublished: true };
        },
        compensate: async () => {
          // Events are fire-and-forget, no direct compensation possible
          // We could publish a "registration cancelled" event if needed
          this.logger.log('Publishing registration cancellation event', {
            userId: sagaData.createdUser?.id
          });
          
          try {
            await this.eventBusService.publishSecurityEvent(new SecurityEventDto({
              userId: sagaData.createdUser?.id || 'unknown',
              type: 'registration',
              ipAddress,
              metadata: {
                reason: 'saga_compensation',
                originalEmail: sagaData.registerDto.email,
                compensationTimestamp: new Date(),
                cancelled: true,
              },
              timestamp: new Date(),
            }));
          } catch (error) {
            this.logger.error('Failed to publish registration cancellation event', {
              error: error.message,
            });
          }
        },
        maxRetries: 2,
        timeout: 5000,
      },
    ];

    return this.sagaService.startSaga(
      'userRegistration',
      steps,
      {
        email: registerDto.email,
        ipAddress,
        userAgent,
        startTime: new Date(),
      }
    );
  }

  /**
   * Executes user login as a saga transaction
   * Steps: generateTokens → enforceSessionLimit → createSession → publishEvents
   * @param user User object
   * @param ipAddress Client IP address
   * @param userAgent Client user agent
   * @param maxSessionsPerUser Maximum sessions per user
   * @returns Saga ID for tracking
   */
  async executeLoginSaga(
    user: any,
    ipAddress: string,
    userAgent: string,
    maxSessionsPerUser: number
  ): Promise<string> {
    const sagaData: LoginSagaData = {
      user,
      ipAddress,
      userAgent,
      maxSessionsPerUser,
    };

    const steps: Omit<SagaStep, 'id'>[] = [
      {
        name: 'generateTokens',
        execute: async () => {
          this.logger.log('Generating JWT tokens for login', { userId: user.id });
          
          const tokenResult = await this.tokenService.generateTokens(user);
          sagaData.generatedTokens = {
            accessToken: tokenResult.accessToken,
            refreshToken: tokenResult.refreshToken,
          };
          
          return { tokens: sagaData.generatedTokens };
        },
        compensate: async () => {
          if (sagaData.generatedTokens) {
            this.logger.log('Compensating: Blacklisting login tokens', {
              userId: user.id
            });
            
            try {
              await this.tokenService.blacklistToken(
                sagaData.generatedTokens.accessToken,
                user.id,
                'admin'
              );
              
              await this.tokenService.blacklistToken(
                sagaData.generatedTokens.refreshToken,
                user.id,
                'admin'
              );
              
            } catch (error) {
              this.logger.error('Failed to compensate login token generation', {
                userId: user.id,
                error: error.message,
              });
            }
            
            sagaData.generatedTokens = undefined;
          }
        },
        maxRetries: 2,
        timeout: 5000,
      },

      {
        name: 'createSessionWithLimit',
        execute: async () => {
          if (!sagaData.generatedTokens) {
            throw new Error('Tokens must be generated before creating session');
          }
          
          this.logger.log('Creating session with limit enforcement', { 
            userId: user.id,
            maxSessions: maxSessionsPerUser 
          });
          
          // Use the atomic session creation with limit enforcement
          const result = await this.sessionService.createSessionWithLimit({
            userId: user.id,
            accessToken: sagaData.generatedTokens.accessToken,
            refreshToken: sagaData.generatedTokens.refreshToken,
            ipAddress,
            userAgent,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          }, maxSessionsPerUser);
          
          sagaData.createdSession = result.session;
          sagaData.removedSessionsCount = result.removedSessionsCount;
          
          return { 
            session: sagaData.createdSession,
            removedSessionsCount: sagaData.removedSessionsCount 
          };
        },
        compensate: async () => {
          if (sagaData.createdSession) {
            this.logger.log('Compensating: Invalidating login session', {
              sessionId: sagaData.createdSession.id,
              userId: user.id
            });
            
            try {
              await this.sessionService.invalidateSession(sagaData.createdSession.id);
            } catch (error) {
              this.logger.error('Failed to compensate login session creation', {
                sessionId: sagaData.createdSession.id,
                error: error.message,
              });
            }
            
            sagaData.createdSession = undefined;
          }
        },
        maxRetries: 2,
        timeout: 10000, // Longer timeout for session limit enforcement
      },

      {
        name: 'publishLoginEvents',
        execute: async () => {
          this.logger.log('Publishing login events', { userId: user.id });
          
          // Publish UserLoggedInEvent for event-driven processing
          await this.eventBusService.publishUserLoggedInEvent(new UserLoggedInEvent({
            userId: user.id,
            sessionId: sagaData.createdSession?.id || 'unknown',
            ipAddress,
            userAgent,
            timestamp: new Date(),
          }));
          
          // If sessions were removed due to limit, publish security event
          if ((sagaData.removedSessionsCount || 0) > 0) {
            await this.eventBusService.publishSecurityEvent(new SecurityEventDto({
              userId: user.id,
              type: 'login',
              ipAddress,
              userAgent,
              timestamp: new Date(),
              metadata: { 
                sessionLimitEnforced: true,
                removedSessionsCount: sagaData.removedSessionsCount,
                maxSessionsAllowed: maxSessionsPerUser,
                raceConditionProtected: true,
                sagaTransactionUsed: true
              }
            }));
          }
          
          return { eventsPublished: true };
        },
        compensate: async () => {
          // Publish login cancellation event
          this.logger.log('Publishing login cancellation event', { userId: user.id });
          
          try {
            await this.eventBusService.publishSecurityEvent(new SecurityEventDto({
              userId: user.id,
              type: 'login',
              ipAddress,
              metadata: {
                reason: 'saga_compensation',
                sessionId: sagaData.createdSession?.id,
                compensationTimestamp: new Date(),
                cancelled: true,
              },
              timestamp: new Date(),
            }));
          } catch (error) {
            this.logger.error('Failed to publish login cancellation event', {
              error: error.message,
            });
          }
        },
        maxRetries: 2,
        timeout: 5000,
      },
    ];

    return this.sagaService.startSaga(
      'userLogin',
      steps,
      {
        userId: user.id,
        email: user.email,
        ipAddress,
        userAgent,
        maxSessionsPerUser,
        startTime: new Date(),
      }
    );
  }

  /**
   * Gets the result of a registration saga
   * @param sagaId Saga transaction ID
   * @returns Registration result or null if saga not completed
   */
  async getRegistrationResult(sagaId: string): Promise<{
    user: any;
    access_token: string;
    refresh_token: string;
    session_id: string;
    expires_in: number;
  } | null> {
    const saga = await this.sagaService.getSaga(sagaId);
    
    if (!saga || saga.status !== 'completed') {
      return null;
    }

    // Extract results from saga metadata or steps
    const sagaData = saga.metadata as any;
    
    // We need to reconstruct the result from the saga execution
    // In a real implementation, we might store intermediate results in Redis
    // For now, we'll return null and let the caller handle polling
    return null;
  }

  /**
   * Gets the result of a login saga
   * @param sagaId Saga transaction ID
   * @returns Login result or null if saga not completed
   */
  async getLoginResult(sagaId: string): Promise<{
    user: any;
    access_token: string;
    refresh_token: string;
    session_id: string;
    expires_in: number;
  } | null> {
    const saga = await this.sagaService.getSaga(sagaId);
    
    if (!saga || saga.status !== 'completed') {
      return null;
    }

    // Extract results from saga metadata or steps
    // In a real implementation, we might store intermediate results in Redis
    return null;
  }

  /**
   * Waits for a saga to complete and returns the result
   * @param sagaId Saga transaction ID
   * @param timeoutMs Timeout in milliseconds
   * @returns Saga completion status
   */
  async waitForSagaCompletion(
    sagaId: string, 
    timeoutMs: number = 30000
  ): Promise<{ completed: boolean; status: string; error?: string }> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const saga = await this.sagaService.getSaga(sagaId);
      
      if (!saga) {
        return { completed: false, status: 'not_found' };
      }
      
      if (['completed', 'failed', 'compensated'].includes(saga.status)) {
        return { 
          completed: saga.status === 'completed', 
          status: saga.status,
          error: saga.error 
        };
      }
      
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return { completed: false, status: 'timeout' };
  }
}