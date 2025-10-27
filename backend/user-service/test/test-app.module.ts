import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { User } from '../src/user/entities/user.entity';
import { UserService } from '../src/user/user.service';
import { InternalController } from '../src/user/internal.controller';
import { ProfileService } from '../src/profile/profile.service';
// import { APP_GUARD } from '@nestjs/core';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { IntegrationsModule } from '../src/integrations/integrations.module';
import { UserModule } from '../src/user/user.module';
import { ProfileModule } from '../src/profile/profile.module';
import { TestHealthModule } from './test-health.module';
import { AppPrometheusModule } from '../src/common/prometheus/prometheus.module';
import { TestConfigModule } from './test-config.module';
import { TestLoggingModule } from './test-logging.module';
import { SecurityClient } from '../src/integrations/security/security.client';
import { IntegrationService } from '../src/integrations/integration.service';
import { CacheService } from '../src/common/cache/cache.service';
import { BatchService } from '../src/user/batch.service';
import { PaginationService } from '../src/common/services/pagination.service';
import { UserEncryptionService } from '../src/user/services/user-encryption.service';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { StartupValidationService } from '../src/config/startup-validation.service';

@Module({
  imports: [
    // --- Test Config Module (without startup validation) ---
    TestConfigModule,

    // --- Throttler Module with high limits for tests ---
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 1000, // Very high limit for tests
      },
    ]),

    // --- TypeORM Module disabled for tests ---
    // TypeORM is mocked via repository providers below

    // --- Cache Module (In-Memory for tests) ---
    CacheModule.register({
      isGlobal: true,
    }),

    // --- Custom Modules ---
    TestLoggingModule,
    // IntegrationsModule, // Mocked via providers
    // UserModule, // Mocked via providers
    ProfileModule, // Enable ProfileModule for profile endpoint tests
    TestHealthModule,
    AppPrometheusModule,
  ],
  controllers: [
    AppController,
    InternalController,
  ],
  providers: [
    AppService,
    // Mock services for UserService dependencies
    {
      provide: SecurityClient,
      useValue: {
        logSecurityEvent: jest.fn(),
        reportSuspiciousActivity: jest.fn(),
        validateApiKey: jest.fn().mockResolvedValue(true),
      },
    },
    // Mock UserService directly for better test control
    {
      provide: UserService,
      useValue: (() => {
        const createdUsers = new Map();
        const createdEmails = new Set();
        
        return {
          create: jest.fn().mockImplementation(async (createUserDto) => {
            // Check for duplicate email
            if (createdEmails.has(createUserDto.email)) {
              const { UserServiceError } = await import('../src/common/errors');
              throw UserServiceError.userAlreadyExists(createUserDto.email);
            }
            
            // Simulate user creation with valid UUID
            const { v4: uuidv4 } = require('uuid');
            const userId = uuidv4();
            const user = {
              id: userId,
              email: createUserDto.email,
              name: createUserDto.name,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
              lastLoginAt: null,
            };
            
            createdUsers.set(userId, user);
            createdEmails.add(createUserDto.email);
            
            return user;
          }),
          findById: jest.fn().mockImplementation(async (id) => {
            // Return null for specific non-existent users
            const nonExistentIds = ['123e4567-e89b-12d3-a456-426614174000'];
            if (nonExistentIds.includes(id)) {
              return null;
            }
            
            // Return created user if exists
            if (createdUsers.has(id)) {
              return createdUsers.get(id);
            }
            
            // Return a default user for other valid UUIDs
            return {
              id,
              email: 'test@example.com',
              name: 'Test User',
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
              lastLoginAt: null,
            };
          }),
          findByEmail: jest.fn().mockImplementation(async (email) => {
            if (email === 'nonexistent@example.com') {
              return null;
            }
            
            // Find user by email in created users
            for (const user of createdUsers.values()) {
              if (user.email === email) {
                return user;
              }
            }
            
            return null;
          }),
          updateLastLogin: jest.fn().mockImplementation(async (id) => {
            // Throw UserServiceError for non-existent users
            const nonExistentIds = ['123e4567-e89b-12d3-a456-426614174000'];
            if (nonExistentIds.includes(id)) {
              const { UserServiceError } = await import('../src/common/errors');
              throw UserServiceError.userNotFound(id);
            }
            
            // Check if user exists in created users
            if (!createdUsers.has(id)) {
              const { UserServiceError } = await import('../src/common/errors');
              throw UserServiceError.userNotFound(id);
            }
            
            return undefined;
          }),
          update: jest.fn(),
          delete: jest.fn(),
          findUsersBatch: jest.fn().mockResolvedValue(new Map()),
        };
      })(),
    },
    // Mock ProfileService
    {
      provide: ProfileService,
      useValue: {
        getPreferences: jest.fn().mockResolvedValue({}),
        updatePreferences: jest.fn().mockResolvedValue({}),
        updateProfile: jest.fn().mockResolvedValue({}),
        uploadAvatar: jest.fn().mockResolvedValue({}),
      },
    },
    {
      provide: IntegrationService,
      useValue: {
        notifyUserCreated: jest.fn().mockImplementation(async (userId) => {
          // Simulate auth service connection failure but don't throw
          console.log(`Mock: Auth Service notification failed for user ${userId}`);
          return undefined;
        }),
        notifyUserUpdated: jest.fn().mockResolvedValue(undefined),
        notifyUserDeleted: jest.fn().mockResolvedValue(undefined),
        publishUserEvent: jest.fn().mockResolvedValue(undefined),
      },
    },
    {
      provide: CacheService,
      useValue: {
        getUser: jest.fn(),
        setUser: jest.fn(),
        invalidateUser: jest.fn(),
        getUsersBatch: jest.fn(),
        getProfile: jest.fn(),
        setProfile: jest.fn(),
        invalidateProfile: jest.fn(),
        getCacheStats: jest.fn(),
      },
    },
    {
      provide: BatchService,
      useValue: {
        createUsers: jest.fn(),
        getUsersByIds: jest.fn(),
        updateUsers: jest.fn(),
        softDeleteUsers: jest.fn(),
        processInChunks: jest.fn(),
      },
    },
    {
      provide: PaginationService,
      useValue: {
        paginate: jest.fn(),
        createPaginationResponse: jest.fn(),
      },
    },
    {
      provide: UserEncryptionService,
      useValue: {
        encryptSensitiveFields: jest.fn().mockImplementation((user) => {
          // Return user as-is for tests
          return user;
        }),
        decryptSensitiveFields: jest.fn().mockImplementation((user) => {
          // Return user as-is for tests
          return user;
        }),
        prepareUserAfterLoad: jest.fn().mockImplementation((user) => {
          // Return user as-is for tests, ensuring all fields are present
          return {
            ...user,
            email: user.email,
            name: user.name,
            id: user.id,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          };
        }),
        prepareUserBeforeSave: jest.fn().mockImplementation((user) => {
          // Return user as-is for tests
          return user;
        }),
      },
    },
    // Mock StartupValidationService to prevent environment validation in tests
    {
      provide: StartupValidationService,
      useValue: {
        performHealthCheck: jest.fn().mockResolvedValue({
          status: 'ok',
          checks: { environment: { status: 'ok' } }
        }),
        onModuleInit: jest.fn().mockResolvedValue(undefined),
      },
    },
    // ResponseInterceptor should be used as real implementation, not mocked
    // LoggingService and AuditService are provided by LoggingModule
    // ThrottlerGuard is completely disabled in tests
  ],
})
export class TestAppModule { }
