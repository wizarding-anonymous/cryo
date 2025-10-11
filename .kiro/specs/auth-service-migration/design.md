# Design Document

## Overview

This document outlines the design for migrating authentication functionality from User Service to Auth Service, creating a clean separation of concerns between user data management and authentication operations. The migration will result in two focused microservices that communicate via HTTP APIs.

## Architecture

### Current State
```
┌─────────────────────────────────────┐
│           User Service              │
│  ┌─────────────┐ ┌─────────────────┐│
│  │    Auth     │ │   User Data     ││
│  │  Module     │ │   Management    ││
│  │             │ │                 ││
│  │ • Register  │ │ • CRUD Ops      ││
│  │ • Login     │ │ • Profile Mgmt  ││
│  │ • JWT       │ │ • Data Storage  ││
│  │ • Logout    │ │                 ││
│  └─────────────┘ └─────────────────┘│
└─────────────────────────────────────┘
```

### Target Production Architecture
```
┌─────────────────┐    Circuit      ┌─────────────────┐
│   Auth Service  │    Breaker      │  User Service   │
│                 │◄──────────────►│                 │
│ • Registration  │   HTTP APIs     │ • User CRUD     │
│ • Login/Logout  │   (Critical)    │ • Profile Mgmt  │
│ • Token Mgmt    │                 │ • Data Storage  │
│ • JWT Validation│                 │                 │
│ • Password Hash │                 │                 │
│                 │                 │                 │
│ ┌─────────────┐ │                 │ ┌─────────────┐ │
│ │   Auth DB   │ │                 │ │   User DB   │ │
│ │ • Sessions  │ │                 │ │ • Profiles  │ │
│ │ • Tokens    │ │                 │ │ • Metadata  │ │
│ │ • Attempts  │ │                 │ │ • Last Login│ │
│ │ • Blacklist │ │                 │ │             │ │
│ └─────────────┘ │                 │ └─────────────┘ │
└─────────────────┘                 └─────────────────┘
         │                                   
         │ Event Bus (Async)                 
         ▼                                   
┌─────────────────┐                 
│  Event Bus      │                 
│ • Redis/RabbitMQ│                 
│ • Event Store   │                 
│ • Pub/Sub       │                 
└─────────────────┘                 
    │           │
    ▼           ▼
┌─────────────────┐  ┌─────────────────┐
│ Security Service│  │Notification Svc │
│ • Event Logging │  │ • Welcome Emails│
│ • Audit Trail   │  │ • Security Alert│
│ • Suspicious    │  │ • Password Reset│
│   Activity      │  │ • Event-driven  │
└─────────────────┘  └─────────────────┘
```

### Event-Driven Flow
```
Registration Flow:
Auth Service → User Service (sync) → Success
     ↓
Event Bus ← UserRegisteredEvent
     ↓
┌─ Security Service (async) ← Log registration event
└─ Notification Service (async) ← Send welcome email

Login Flow:
Auth Service → User Service (sync) → Validate user
     ↓
Generate Tokens + Store Session
     ↓
Event Bus ← UserLoggedInEvent
     ↓
┌─ Security Service (async) ← Log login event
└─ User Service (async) ← Update last login
```

## Components and Interfaces

### Auth Service Components

#### 1. AuthController
**Responsibility:** Handle HTTP requests for authentication operations
**Endpoints:**
- `POST /auth/register` - User registration
- `POST /auth/login` - User authentication  
- `POST /auth/logout` - User logout with token blacklisting
- `POST /auth/refresh` - Refresh access token
- `POST /auth/validate` - Validate JWT token (for other services)

#### 2. AuthService
**Responsibility:** Core authentication business logic with resilience patterns
**Methods:**
- `register(registerDto)` - Create new user account with Circuit Breaker
- `validateUser(email, password)` - Verify user credentials with fallback
- `login(user)` - Generate tokens and store session locally
- `logout(token, userId)` - Blacklist token and publish event
- `refreshToken(refreshToken)` - Generate new access token
- `validateToken(token)` - Verify token validity with local session check

#### 3. SessionService
**Responsibility:** Local session and authentication data management
**Methods:**
- `createSession(userId, tokenData)` - Store session in Auth DB
- `getSession(sessionId)` - Retrieve session data
- `invalidateSession(sessionId)` - Mark session as invalid
- `cleanupExpiredSessions()` - Remove expired sessions
- `getUserSessions(userId)` - Get all user sessions

#### 4. TokenService
**Responsibility:** JWT token management with local storage
**Methods:**
- `generateTokens(user)` - Generate access and refresh tokens
- `blacklistToken(token)` - Add token to local blacklist
- `isTokenBlacklisted(token)` - Check blacklist (local + Redis)
- `validateTokenStructure(token)` - Verify token format and signature
- `blacklistAllUserTokens(userId)` - Invalidate all user tokens

#### 5. JwtStrategy
**Responsibility:** Passport JWT validation strategy with local checks
**Features:**
- Token signature verification
- Expiration checking
- Local blacklist validation
- Session existence verification
- Fallback user validation

#### 6. Circuit Breaker Clients
**Responsibility:** Resilient communication with external services
**Clients:**
- `UserServiceClient` - User CRUD operations with Circuit Breaker
- `EventBusClient` - Async event publishing
- `RedisClient` - Distributed cache with fallback

#### 7. Event Handlers
**Responsibility:** Handle async events and side effects
**Handlers:**
- `UserRegisteredHandler` - Process registration events
- `UserLoggedInHandler` - Process login events
- `SecurityEventHandler` - Handle security-related events
- `NotificationEventHandler` - Handle notification events

#### 8. Auth Database Components
**Responsibility:** Local data persistence for Auth Service
**Entities:**
- `Session` - User sessions and token metadata
- `LoginAttempt` - Failed login attempts tracking
- `TokenBlacklist` - Blacklisted tokens with TTL
- `SecurityEvent` - Local security event log

### User Service API Changes

#### New Internal Endpoints
```typescript
// User management for Auth Service
POST   /users                    // Create user (internal)
GET    /users/email/:email       // Find by email (internal)  
GET    /users/:id                // Find by ID (internal)
PATCH  /users/:id/last-login     // Update last login (internal)
GET    /users/:id/exists         // Check existence (internal)
```

#### Removed Endpoints
```typescript
// Authentication endpoints (moved to Auth Service)
POST   /auth/register            // → Auth Service
POST   /auth/login               // → Auth Service  
POST   /auth/logout              // → Auth Service
GET    /profile                  // → Profile Service (future)
PUT    /profile                  // → Profile Service (future)
DELETE /profile                  // → Profile Service (future)
POST   /users/change-password    // → Auth Service (future)
```

## Data Models

### Auth Service Database Entities

#### Session Entity
```typescript
@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  accessToken: string;

  @Column()
  refreshToken: string;

  @Column()
  ipAddress: string;

  @Column()
  userAgent: string;

  @Column({ default: true })
  isActive: boolean;

  @Column()
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

#### LoginAttempt Entity
```typescript
@Entity('login_attempts')
export class LoginAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  userId?: string;

  @Column()
  ipAddress: string;

  @Column()
  userAgent: string;

  @Column({ default: false })
  successful: boolean;

  @Column({ nullable: true })
  failureReason?: string;

  @CreateDateColumn()
  attemptedAt: Date;
}
```

#### TokenBlacklist Entity
```typescript
@Entity('token_blacklist')
export class TokenBlacklist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  tokenHash: string;

  @Column()
  userId: string;

  @Column()
  reason: string; // 'logout', 'security', 'expired'

  @Column()
  expiresAt: Date;

  @CreateDateColumn()
  blacklistedAt: Date;
}
```

#### SecurityEvent Entity (Local)
```typescript
@Entity('security_events')
export class SecurityEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  type: string; // 'registration', 'login', 'logout', 'failed_login'

  @Column()
  ipAddress: string;

  @Column('json', { nullable: true })
  metadata?: Record<string, any>;

  @Column({ default: false })
  processed: boolean; // For event publishing

  @CreateDateColumn()
  createdAt: Date;
}
```

### User Service Entity (Updated)
```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude() // Always exclude from serialization
  password: string; // Hashed password

  @Column()
  name: string;

  @Column({ nullable: true })
  lastLoginAt?: Date; // Updated via events

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
```

### DTOs and Interfaces

#### Auth Service DTOs
```typescript
// Registration request
export class RegisterDto {
  name: string;
  email: string;
  password: string; // Will be hashed by Auth Service
}

// Login request  
export class LoginDto {
  email: string;
  password: string;
}

// Auth response with session info
export interface AuthResponse {
  user: Omit<User, 'password'>;
  access_token: string;
  refresh_token: string;
  session_id: string;
  expires_in: number;
}

// Token validation request
export class ValidateTokenDto {
  token: string;
}

// Session info response
export interface SessionInfo {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  createdAt: Date;
  expiresAt: Date;
}
```

#### Event DTOs
```typescript
// User registration event
export class UserRegisteredEvent {
  userId: string;
  email: string;
  name: string;
  ipAddress: string;
  timestamp: Date;
}

// User login event
export class UserLoggedInEvent {
  userId: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

// Security event
export class SecurityEventDto {
  userId: string;
  type: 'registration' | 'login' | 'logout' | 'failed_login' | 'suspicious_activity';
  ipAddress: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}
```

## Error Handling

### Auth Service Error Responses
```typescript
// Registration errors
409 Conflict - "Пользователь с таким email уже существует"
400 Bad Request - Password validation errors
400 Bad Request - Email format errors

// Login errors  
401 Unauthorized - "Неверный email или пароль"
429 Too Many Requests - Rate limiting

// Token errors
401 Unauthorized - "Токен недействителен (в черном списке)"
401 Unauthorized - "Пользователь не найден или удален"
```

### Service Integration Error Handling
```typescript
// User Service communication errors
try {
  const user = await this.userServiceClient.findByEmail(email);
} catch (error) {
  if (error.response?.status === 404) {
    return null; // User not found
  }
  throw new ServiceUnavailableException('User Service unavailable');
}
```

## Testing Strategy

### Unit Tests
- AuthService business logic
- TokenService token management
- Password hashing and validation
- JWT token generation and verification

### Integration Tests  
- HTTP client communication with User Service
- Redis token blacklisting
- External service integrations

### E2E Tests
```typescript
describe('Auth Service E2E', () => {
  // Registration flow
  it('should register new user and return tokens');
  it('should reject duplicate email registration');
  it('should validate password strength');
  
  // Login flow
  it('should authenticate valid credentials');
  it('should reject invalid credentials');
  it('should update last login timestamp');
  
  // Logout flow
  it('should blacklist token on logout');
  it('should reject blacklisted tokens');
  
  // Token management
  it('should refresh valid refresh token');
  it('should validate tokens for other services');
});
```

### Migration Tests
```typescript
describe('Migration Validation', () => {
  it('should remove all auth endpoints from User Service');
  it('should maintain user data integrity');
  it('should handle existing JWT tokens during transition');
  it('should route auth requests to Auth Service');
});
```

## Resilience and Circuit Breaker Implementation

### Circuit Breaker Configuration
```typescript
@Injectable()
export class UserServiceClient {
  private circuitBreaker: CircuitBreaker;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.circuitBreaker = new CircuitBreaker(this.makeRequest.bind(this), {
      timeout: 3000,                    // 3 second timeout
      errorThresholdPercentage: 50,     // Open circuit at 50% error rate
      resetTimeout: 30000,              // Try to close circuit after 30 seconds
      rollingCountTimeout: 10000,       // 10 second rolling window
      rollingCountBuckets: 10,          // 10 buckets in rolling window
      volumeThreshold: 10,              // Minimum 10 requests before opening
    });

    // Circuit breaker events
    this.circuitBreaker.on('open', () => 
      this.logger.warn('User Service circuit breaker opened'));
    this.circuitBreaker.on('halfOpen', () => 
      this.logger.log('User Service circuit breaker half-open'));
    this.circuitBreaker.on('close', () => 
      this.logger.log('User Service circuit breaker closed'));
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      return await this.circuitBreaker.fire('findByEmail', email);
    } catch (error) {
      if (error.name === 'OpenCircuitError') {
        // Fallback: check local cache or return null
        return await this.getCachedUser(email);
      }
      throw error;
    }
  }

  private async makeRequest(operation: string, ...args: any[]): Promise<any> {
    switch (operation) {
      case 'findByEmail':
        return this.doFindByEmail(args[0]);
      case 'createUser':
        return this.doCreateUser(args[0]);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
}
```

### Fallback Strategies
```typescript
@Injectable()
export class AuthService {
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    try {
      // Primary path: Create user in User Service
      const user = await this.userServiceClient.createUser({
        name: registerDto.name,
        email: registerDto.email,
        password: await this.hashPassword(registerDto.password),
      });

      // Generate tokens and create local session
      const tokens = await this.tokenService.generateTokens(user);
      const session = await this.sessionService.createSession(user.id, tokens);

      // Async: Publish registration event
      this.eventBus.publish(new UserRegisteredEvent({
        userId: user.id,
        email: user.email,
        name: user.name,
        ipAddress: this.getClientIp(),
        timestamp: new Date(),
      }));

      return {
        user: this.excludePassword(user),
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        session_id: session.id,
        expires_in: tokens.expiresIn,
      };

    } catch (error) {
      if (error.name === 'OpenCircuitError') {
        // Fallback: Store registration request for later processing
        await this.storeRegistrationRequest(registerDto);
        throw new ServiceUnavailableException(
          'Registration service temporarily unavailable. Please try again later.'
        );
      }
      throw error;
    }
  }
}
```

## Event-Driven Architecture Implementation

### Event Bus Configuration
```typescript
@Module({
  imports: [
    // Redis for event bus
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
      },
    }),
    // Event queues
    BullModule.registerQueue(
      { name: 'security-events' },
      { name: 'notification-events' },
      { name: 'user-events' },
    ),
  ],
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventBusModule {}
```

### Event Publishing
```typescript
@Injectable()
export class EventBusService {
  constructor(
    @InjectQueue('security-events') private securityQueue: Queue,
    @InjectQueue('notification-events') private notificationQueue: Queue,
    @InjectQueue('user-events') private userQueue: Queue,
  ) {}

  async publishSecurityEvent(event: SecurityEventDto): Promise<void> {
    await this.securityQueue.add('log-security-event', event, {
      attempts: 3,
      backoff: 'exponential',
      delay: 1000,
    });
  }

  async publishNotificationEvent(event: NotificationEventDto): Promise<void> {
    await this.notificationQueue.add('send-notification', event, {
      attempts: 5,
      backoff: 'exponential',
      delay: 2000,
    });
  }

  async publishUserEvent(event: UserEventDto): Promise<void> {
    await this.userQueue.add('update-user-data', event, {
      attempts: 3,
      backoff: 'exponential',
      delay: 1000,
    });
  }
}
```

### Event Handlers
```typescript
@Processor('security-events')
export class SecurityEventProcessor {
  constructor(private readonly securityServiceClient: SecurityServiceClient) {}

  @Process('log-security-event')
  async handleSecurityEvent(job: Job<SecurityEventDto>): Promise<void> {
    const event = job.data;
    try {
      await this.securityServiceClient.logSecurityEvent(event);
      // Mark local event as processed
      await this.markEventProcessed(event.id);
    } catch (error) {
      // Event will be retried automatically
      throw error;
    }
  }
}

@Processor('notification-events')
export class NotificationEventProcessor {
  constructor(private readonly notificationServiceClient: NotificationServiceClient) {}

  @Process('send-notification')
  async handleNotificationEvent(job: Job<NotificationEventDto>): Promise<void> {
    const event = job.data;
    try {
      switch (event.type) {
        case 'welcome':
          await this.notificationServiceClient.sendWelcomeNotification(
            event.userId, event.email
          );
          break;
        case 'security_alert':
          await this.notificationServiceClient.sendSecurityAlert(
            event.userId, event.email, event.alertType
          );
          break;
      }
    } catch (error) {
      // Event will be retried automatically
      throw error;
    }
  }
}
```

## Security Considerations

### Password Security
- Bcrypt hashing with configurable salt rounds
- Strong password validation (8+ chars, mixed case, numbers, symbols)
- No plain text password storage or transmission

### Token Security  
- JWT with configurable expiration (default: 1 hour)
- Refresh tokens with longer expiration (default: 7 days)
- Token blacklisting in Redis with TTL
- Secure token validation for other services

### Rate Limiting
```typescript
// Throttling configuration
ThrottlerModule.forRoot([
  { name: 'short', ttl: 1000, limit: 3 },    // 3/second
  { name: 'medium', ttl: 10000, limit: 20 },  // 20/10sec  
  { name: 'long', ttl: 60000, limit: 100 },   // 100/minute
])
```

### Audit Logging
- All authentication events logged to Security Service
- Failed login attempts tracking
- Password change events
- Account creation and deletion events

## Deployment and Configuration

### Environment Variables

#### Local Development
```bash
# Auth Service Configuration
PORT=3001
JWT_SECRET=secure-secret-key
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/auth_db
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=auth_db
DATABASE_USERNAME=auth_user
DATABASE_PASSWORD=secure_password

# Redis Configuration (Event Bus + Cache)
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# Circuit Breaker Configuration
CIRCUIT_BREAKER_TIMEOUT=3000
CIRCUIT_BREAKER_ERROR_THRESHOLD=50
CIRCUIT_BREAKER_RESET_TIMEOUT=30000

# Service Integration URLs
USER_SERVICE_URL=http://localhost:3002
SECURITY_SERVICE_URL=http://localhost:3010  
NOTIFICATION_SERVICE_URL=http://localhost:3007
```

#### Docker Configuration
```bash
# Auth Service Configuration
PORT=3001
NODE_ENV=production

# Database Configuration (Docker internal network)
DATABASE_URL=postgresql://auth_service:auth_password@postgres-auth:5432/auth_db
DATABASE_HOST=postgres-auth
DATABASE_PORT=5432
DATABASE_NAME=auth_db
DATABASE_USERNAME=auth_service
DATABASE_PASSWORD=auth_password

# Redis Configuration (Docker internal network)
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# Service URLs (Docker internal network)
USER_SERVICE_URL=http://user-service:3002
SECURITY_SERVICE_URL=http://security-service:3010
NOTIFICATION_SERVICE_URL=http://notification-service:3007

# Event Bus Configuration
EVENT_BUS_RETRY_ATTEMPTS=3
EVENT_BUS_RETRY_DELAY=1000
SECURITY_EVENTS_QUEUE=security-events
NOTIFICATION_EVENTS_QUEUE=notification-events
USER_EVENTS_QUEUE=user-events

# Session Configuration
SESSION_CLEANUP_INTERVAL=3600000  # 1 hour in ms
SESSION_MAX_AGE=86400000          # 24 hours in ms
MAX_SESSIONS_PER_USER=5

# Rate Limiting
RATE_LIMIT_WINDOW=60000           # 1 minute
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_WINDOW=900000    # 15 minutes
LOGIN_RATE_LIMIT_MAX_ATTEMPTS=5
```

### Docker Configuration

#### Dockerfile (Multi-stage build)
```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm cache clean --force
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/health-check.js ./health-check.js
USER nestjs
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node health-check.js || exit 1
CMD ["node", "dist/main.js"]
```

#### Docker Compose Integration
Auth Service is integrated into the main backend docker-compose.yml:

```yaml
# Auth Service
auth-service:
  build:
    context: ./auth-service
    dockerfile: Dockerfile
  container_name: auth-service
  ports:
    - "3001:3001"
  depends_on:
    - postgres-auth
    - redis
  env_file:
    - ./auth-service/.env.docker
  environment:
    - REDIS_PASSWORD=${REDIS_PASSWORD:-redis_password}
  networks:
    - microservices-network
  restart: unless-stopped

# Auth Service Database
postgres-auth:
  image: postgres:15-alpine
  container_name: cryo-postgres-auth-db
  environment:
    POSTGRES_USER: auth_service
    POSTGRES_PASSWORD: auth_password
    POSTGRES_DB: auth_db
  ports:
    - "5432:5432"
  volumes:
    - postgres_auth_data:/var/lib/postgresql/data
  networks:
    - microservices-network
  restart: unless-stopped
```

#### Service Ports in Docker
- **Auth Service**: 3001
- **User Service**: 3002  
- **Game Catalog**: 3003
- **Library Service**: 3004
- **Review Service**: 3005
- **Payment Service**: 3006
- **Notification Service**: 3007
- **Social Service**: 3008
- **Achievement Service**: 3009
- **Security Service**: 3010
- **Download Service**: 3011

### Health Checks
- `/api/health` - Overall service health
- `/api/health/ready` - Readiness probe
- `/api/health/live` - Liveness probe
- Memory usage monitoring
- External service connectivity checks

## Migration Strategy

### Phase 1: Preparation
1. Create Auth Service with all authentication logic
2. Add User Service internal endpoints
3. Update User entity with lastLoginAt field
4. Deploy Auth Service alongside existing User Service

### Phase 2: Integration Testing
1. Test Auth Service with User Service integration
2. Validate token generation and validation
3. Test external service integrations
4. Performance and load testing

### Phase 3: Traffic Migration  
1. Update API Gateway to route auth requests to Auth Service
2. Monitor both services during transition
3. Validate existing tokens continue to work
4. Gradual traffic shift with rollback capability

### Phase 4: Cleanup
1. Remove authentication modules from User Service
2. Remove unused dependencies and routes
3. Update User Service documentation
4. Archive old authentication code

## Monitoring and Observability

### Metrics
- Authentication success/failure rates
- Token generation and validation latency
- Service integration response times
- Redis connection health

### Logging
- Structured logging with correlation IDs
- Authentication event logging
- Error tracking and alerting
- Performance monitoring

### Alerts
- High authentication failure rates
- Service integration failures  
- Redis connectivity issues
- Unusual authentication patterns