# Logging Usage Examples

## Basic Logging

### Service-level Logging

```typescript
import { Injectable } from '@nestjs/common';
import { LoggingService } from '../common/logging';

@Injectable()
export class UserService {
  constructor(private readonly loggingService: LoggingService) {}

  async createUser(userData: CreateUserDto, correlationId: string): Promise<User> {
    const startTime = Date.now();

    this.loggingService.info('Starting user creation', {
      correlationId,
      operation: 'user_create_start',
      metadata: {
        email: userData.email,
        hasPassword: !!userData.password,
      },
    });

    try {
      const user = await this.userRepository.save(userData);
      const duration = Date.now() - startTime;

      this.loggingService.info('User created successfully', {
        correlationId,
        operation: 'user_create_success',
        duration,
        metadata: {
          userId: user.id,
          email: user.email,
        },
      });

      return user;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.loggingService.error('User creation failed', {
        correlationId,
        operation: 'user_create_error',
        duration,
        metadata: {
          email: userData.email,
          errorMessage: error.message,
        },
      }, error);

      throw error;
    }
  }
}
```

### Controller-level Logging

```typescript
import { Controller, Post, Body, Req } from '@nestjs/common';
import { Request } from 'express';
import { LoggingService } from '../common/logging';

@Controller('users')
export class UserController {
  constructor(private readonly loggingService: LoggingService) {}

  @Post()
  async createUser(@Body() userData: CreateUserDto, @Req() request: Request) {
    const correlationId = (request as any).correlationId;
    const ipAddress = request.ip;
    const userAgent = request.get('User-Agent');

    this.loggingService.info('User creation request received', {
      correlationId,
      operation: 'user_create_request',
      ipAddress,
      userAgent,
      metadata: {
        email: userData.email,
        requestSize: JSON.stringify(userData).length,
      },
    });

    const result = await this.userService.createUser(userData, correlationId);

    this.loggingService.info('User creation request completed', {
      correlationId,
      operation: 'user_create_response',
      ipAddress,
      userAgent,
      metadata: {
        userId: result.id,
        success: true,
      },
    });

    return result;
  }
}
```

## Audit Logging

### Data Access Logging

```typescript
import { Injectable } from '@nestjs/common';
import { AuditService } from '../common/logging';

@Injectable()
export class UserService {
  constructor(private readonly auditService: AuditService) {}

  async getUserById(id: string, requestContext: any): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (user) {
      // Log successful data access
      this.auditService.logDataAccess({
        operation: 'READ',
        table: 'users',
        recordId: id,
        userId: requestContext.userId || 'system',
        correlationId: requestContext.correlationId,
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
        fieldsAccessed: ['id', 'email', 'name', 'createdAt'],
        success: true,
      });
    }

    return user;
  }

  async updateUser(id: string, updateData: any, requestContext: any): Promise<User> {
    const originalUser = await this.userRepository.findOne({ where: { id } });
    const updatedUser = await this.userRepository.save({ ...originalUser, ...updateData });

    // Log data modification with changes
    this.auditService.logDataAccess({
      operation: 'UPDATE',
      table: 'users',
      recordId: id,
      userId: requestContext.userId,
      correlationId: requestContext.correlationId,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      changes: {
        name: { from: originalUser.name, to: updatedUser.name },
        email: { from: originalUser.email, to: updatedUser.email },
      },
      success: true,
    });

    return updatedUser;
  }
}
```

### Authentication Events

```typescript
@Injectable()
export class AuthService {
  constructor(private readonly auditService: AuditService) {}

  async login(credentials: LoginDto, requestContext: any): Promise<AuthResult> {
    try {
      const user = await this.validateCredentials(credentials);
      
      // Log successful authentication
      this.auditService.logAuthenticationEvent(
        'LOGIN_SUCCESS',
        user.id,
        requestContext.correlationId,
        requestContext.ipAddress,
        requestContext.userAgent,
        true,
        {
          loginMethod: 'password',
          userAgent: requestContext.userAgent,
        }
      );

      return { user, token: this.generateToken(user) };
    } catch (error) {
      // Log failed authentication
      this.auditService.logAuthenticationEvent(
        'LOGIN_FAILED',
        credentials.email, // Use email as identifier for failed attempts
        requestContext.correlationId,
        requestContext.ipAddress,
        requestContext.userAgent,
        false,
        {
          reason: error.message,
          loginMethod: 'password',
        }
      );

      throw error;
    }
  }
}
```

## Performance Logging

### Database Operations

```typescript
@Injectable()
export class UserRepository {
  constructor(private readonly loggingService: LoggingService) {}

  async findUsersBatch(ids: string[], correlationId: string): Promise<User[]> {
    const startTime = Date.now();

    try {
      const users = await this.repository.findByIds(ids);
      const duration = Date.now() - startTime;

      this.loggingService.logDatabaseOperation(
        'BATCH_READ',
        'users',
        correlationId,
        duration,
        true,
        users.length
      );

      // Log performance warning for slow queries
      if (duration > 1000) {
        this.loggingService.warn('Slow database query detected', {
          correlationId,
          operation: 'slow_query_warning',
          duration,
          metadata: {
            table: 'users',
            operation: 'BATCH_READ',
            recordCount: ids.length,
            threshold: 1000,
          },
        });
      }

      return users;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.loggingService.logDatabaseOperation(
        'BATCH_READ',
        'users',
        correlationId,
        duration,
        false,
        0,
        error
      );

      throw error;
    }
  }
}
```

### Cache Operations

```typescript
@Injectable()
export class CacheService {
  constructor(private readonly loggingService: LoggingService) {}

  async getUser(id: string, correlationId: string): Promise<User | null> {
    const startTime = Date.now();
    const cacheKey = `user:${id}`;

    try {
      const cachedUser = await this.redis.get(cacheKey);
      const duration = Date.now() - startTime;
      const hit = !!cachedUser;

      this.loggingService.logCacheOperation(
        'get',
        cacheKey,
        correlationId,
        duration,
        hit
      );

      return cachedUser ? JSON.parse(cachedUser) : null;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.loggingService.logCacheOperation(
        'get',
        cacheKey,
        correlationId,
        duration,
        false,
        { error: error.message }
      );

      return null; // Graceful degradation
    }
  }
}
```

## Security Logging

### Suspicious Activity Detection

```typescript
@Injectable()
export class SecurityService {
  constructor(private readonly loggingService: LoggingService) {}

  async detectSuspiciousActivity(userId: string, requestContext: any): Promise<void> {
    const recentFailedAttempts = await this.getRecentFailedAttempts(userId);

    if (recentFailedAttempts > 5) {
      this.loggingService.logSecurityEvent(
        'Multiple failed login attempts detected',
        userId,
        requestContext.correlationId,
        requestContext.ipAddress,
        requestContext.userAgent,
        'high',
        {
          failedAttempts: recentFailedAttempts,
          timeWindow: '15 minutes',
          action: 'account_locked',
        }
      );

      await this.lockUserAccount(userId);
    }
  }

  async logUnauthorizedAccess(resource: string, requestContext: any): Promise<void> {
    this.loggingService.logSecurityEvent(
      'Unauthorized resource access attempt',
      requestContext.userId || 'anonymous',
      requestContext.correlationId,
      requestContext.ipAddress,
      requestContext.userAgent,
      'medium',
      {
        resource,
        method: requestContext.method,
        url: requestContext.url,
      }
    );
  }
}
```

## Method Decorators

### Automatic Logging with Decorators

```typescript
import { LogMethod, LogDatabaseOperation, LogCacheOperation } from '../common/logging';

@Injectable()
export class UserService {
  @LogMethod({
    level: 'info',
    logArgs: true,
    logResult: false,
    logDuration: true,
    operation: 'user_service_create_user',
    sensitiveArgs: [0], // Don't log the first argument (user data)
  })
  async createUser(userData: CreateUserDto): Promise<User> {
    // Method implementation
    return this.userRepository.save(userData);
  }

  @LogDatabaseOperation('users', 'findById')
  async findById(id: string): Promise<User> {
    return this.userRepository.findOne({ where: { id } });
  }

  @LogCacheOperation('get')
  async getCachedUser(id: string): Promise<User | null> {
    return this.cacheService.get(`user:${id}`);
  }
}
```

## Error Handling

### Structured Error Logging

```typescript
@Injectable()
export class UserService {
  constructor(private readonly loggingService: LoggingService) {}

  async processUserData(userData: any, correlationId: string): Promise<void> {
    try {
      await this.validateUserData(userData);
      await this.saveUserData(userData);
    } catch (error) {
      if (error instanceof ValidationError) {
        this.loggingService.warn('User data validation failed', {
          correlationId,
          operation: 'user_validation_error',
          metadata: {
            validationErrors: error.errors,
            userData: this.sanitizeUserData(userData),
          },
        });
      } else if (error instanceof DatabaseError) {
        this.loggingService.error('Database operation failed', {
          correlationId,
          operation: 'database_error',
          metadata: {
            errorCode: error.code,
            constraint: error.constraint,
          },
        }, error);
      } else {
        this.loggingService.error('Unexpected error in user processing', {
          correlationId,
          operation: 'unexpected_error',
          metadata: {
            errorType: error.constructor.name,
          },
        }, error);
      }

      throw error;
    }
  }

  private sanitizeUserData(userData: any): any {
    const { password, ...sanitized } = userData;
    return sanitized;
  }
}
```

## Integration with Interceptors

### Custom Logging Interceptor

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { LoggingService } from '../logging';

@Injectable()
export class CustomLoggingInterceptor implements NestInterceptor {
  constructor(private readonly loggingService: LoggingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const correlationId = request.correlationId;
    const startTime = Date.now();

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        
        this.loggingService.info('Request completed successfully', {
          correlationId,
          operation: 'request_success',
          duration,
          metadata: {
            controller: context.getClass().name,
            handler: context.getHandler().name,
            responseSize: JSON.stringify(data).length,
          },
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        
        this.loggingService.error('Request failed', {
          correlationId,
          operation: 'request_error',
          duration,
          metadata: {
            controller: context.getClass().name,
            handler: context.getHandler().name,
            errorType: error.constructor.name,
          },
        }, error);

        throw error;
      })
    );
  }
}
```

## Monitoring and Alerting

### Health Check Logging

```typescript
@Injectable()
export class HealthService {
  constructor(private readonly loggingService: LoggingService) {}

  async checkDatabaseHealth(): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      await this.database.query('SELECT 1');
      const duration = Date.now() - startTime;

      this.loggingService.info('Database health check passed', {
        correlationId: 'health-check',
        operation: 'health_check_database',
        duration,
        metadata: {
          status: 'healthy',
        },
      });

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.loggingService.error('Database health check failed', {
        correlationId: 'health-check',
        operation: 'health_check_database',
        duration,
        metadata: {
          status: 'unhealthy',
        },
      }, error);

      return false;
    }
  }
}
```

## Best Practices Summary

1. **Always include correlation IDs** for request tracing
2. **Use structured metadata** instead of string interpolation
3. **Log at appropriate levels** (ERROR for failures, INFO for business events, DEBUG for diagnostics)
4. **Sanitize sensitive data** before logging
5. **Include performance metrics** (duration, record counts)
6. **Use consistent operation names** for easier searching
7. **Log both success and failure cases** for complete audit trails
8. **Include contextual information** (IP address, user agent, user ID)
9. **Use decorators** for automatic logging of common patterns
10. **Handle logging errors gracefully** to avoid impacting application performance