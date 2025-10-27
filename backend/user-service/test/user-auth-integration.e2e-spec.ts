import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { LoggingService } from '../src/common/logging/logging.service';
import { AuthIntegrationHelper, AuthTestUser, AuthTokens } from './helpers/auth-integration.helper';

describe('User Auth Integration (e2e)', () => {
  let app: INestApplication;
  let authHelper: AuthIntegrationHelper;

  beforeAll(async () => {
    // Initialize Auth Service integration helper
    authHelper = new AuthIntegrationHelper();

    // Check if Auth Service is available
    const isAuthAvailable = await authHelper.isAuthServiceAvailable();
    if (!isAuthAvailable) {
      console.warn('⚠️  Auth Service is not available. Skipping auth integration tests.');
      return;
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same global pipes, filters, and interceptors as in main.ts
    const httpAdapterHost = app.get(HttpAdapterHost);
    const loggingService = app.get(LoggingService);
    app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost, loggingService));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    console.log('✅ User Service test app initialized');
  }, 30000);

  afterAll(async () => {
    if (app) {
      try {
        await app.close();
      } catch (error) {
        console.warn('Failed to close app:', error.message);
      }
    }
  });

  describe('User Profile Management with Auth Service Integration', () => {
    let testUser: AuthTestUser;
    let tokens: AuthTokens;

    beforeAll(async () => {
      // Skip if Auth Service is not available
      const isAuthAvailable = await authHelper.isAuthServiceAvailable();
      if (!isAuthAvailable) {
        console.warn('⚠️  Skipping auth integration tests - Auth Service not available');
        return;
      }

      // Create test user and register via Auth Service
      testUser = authHelper.createTestUser('user-profile');
      
      try {
        console.log('📝 Registering test user via Auth Service...');
        await authHelper.registerUser(testUser);
        
        console.log('🔐 Logging in test user via Auth Service...');
        tokens = await authHelper.loginUser(testUser.email, testUser.password);
        
        console.log('✅ Test user setup complete');
      } catch (error) {
        console.error('❌ Failed to setup test user:', error.message);
        throw error;
      }
    });

    describe('GET /users/profile', () => {
      it('should get user profile with valid Auth Service token', async () => {
        // Skip if Auth Service is not available
        const isAuthAvailable = await authHelper.isAuthServiceAvailable();
        if (!isAuthAvailable) {
          console.warn('⚠️  Skipping test - Auth Service not available');
          return;
        }

        console.log('🔍 Testing user profile retrieval with Auth Service token...');

        const response = await request(app.getHttpServer())
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${tokens.access_token}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.email).toEqual(testUser.email);
        expect(response.body.data.name).toEqual(testUser.name);
        expect(response.body.data).not.toHaveProperty('password');
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data).toHaveProperty('createdAt');
        expect(response.body.data).toHaveProperty('updatedAt');

        console.log('✅ User profile retrieved successfully');
      });

      it('should return 401 for missing token', async () => {
        const isAuthAvailable = await authHelper.isAuthServiceAvailable();
        if (!isAuthAvailable) {
          console.warn('⚠️  Skipping test - Auth Service not available');
          return;
        }

        await request(app.getHttpServer())
          .get('/api/users/profile')
          .expect(401);
      });

      it('should return 401 for invalid token', async () => {
        const isAuthAvailable = await authHelper.isAuthServiceAvailable();
        if (!isAuthAvailable) {
          console.warn('⚠️  Skipping test - Auth Service not available');
          return;
        }

        await request(app.getHttpServer())
          .get('/api/users/profile')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);
      });
    });

    describe('PUT /users/profile', () => {
      it('should update user profile successfully with Auth Service token', async () => {
        const isAuthAvailable = await authHelper.isAuthServiceAvailable();
        if (!isAuthAvailable) {
          console.warn('⚠️  Skipping test - Auth Service not available');
          return;
        }

        console.log('📝 Testing user profile update with Auth Service token...');

        const updatedName = 'Updated User Name';
        const response = await request(app.getHttpServer())
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${tokens.access_token}`)
          .send({ name: updatedName })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toEqual(updatedName);
        expect(response.body.data.email).toEqual(testUser.email);
        expect(response.body.data).not.toHaveProperty('password');

        console.log('✅ User profile updated successfully');
      });

      it('should return 400 for invalid name (empty string)', async () => {
        const isAuthAvailable = await authHelper.isAuthServiceAvailable();
        if (!isAuthAvailable) {
          console.warn('⚠️  Skipping test - Auth Service not available');
          return;
        }

        const response = await request(app.getHttpServer())
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${tokens.access_token}`)
          .send({ name: '' })
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should return 401 for missing token', async () => {
        const isAuthAvailable = await authHelper.isAuthServiceAvailable();
        if (!isAuthAvailable) {
          console.warn('⚠️  Skipping test - Auth Service not available');
          return;
        }

        await request(app.getHttpServer())
          .put('/api/users/profile')
          .send({ name: 'New Name' })
          .expect(401);
      });

      it('should allow empty body (no updates)', async () => {
        const isAuthAvailable = await authHelper.isAuthServiceAvailable();
        if (!isAuthAvailable) {
          console.warn('⚠️  Skipping test - Auth Service not available');
          return;
        }

        const response = await request(app.getHttpServer())
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${tokens.access_token}`)
          .send({})
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.email).toEqual(testUser.email);
      });
    });

    describe('DELETE /users/profile', () => {
      it('should delete user profile successfully with Auth Service token', async () => {
        const isAuthAvailable = await authHelper.isAuthServiceAvailable();
        if (!isAuthAvailable) {
          console.warn('⚠️  Skipping test - Auth Service not available');
          return;
        }

        // Create a separate user for deletion test
        const deleteTestUser = authHelper.createTestUser('delete-test');
        
        try {
          console.log('📝 Creating user for deletion test...');
          await authHelper.registerUser(deleteTestUser);
          const deleteTokens = await authHelper.loginUser(deleteTestUser.email, deleteTestUser.password);

          console.log('🗑️  Testing user profile deletion...');
          const response = await request(app.getHttpServer())
            .delete('/api/users/profile')
            .set('Authorization', `Bearer ${deleteTokens.access_token}`)
            .expect(200);

          expect(response.body.success).toBe(true);
          expect(response.body.message).toContain('удален');

          console.log('✅ User profile deleted successfully');

          // Verify user cannot access profile after deletion
          await request(app.getHttpServer())
            .get('/api/users/profile')
            .set('Authorization', `Bearer ${deleteTokens.access_token}`)
            .expect(401);

        } catch (error) {
          console.error('❌ Failed deletion test:', error.message);
          throw error;
        }
      });

      it('should return 401 for missing token', async () => {
        const isAuthAvailable = await authHelper.isAuthServiceAvailable();
        if (!isAuthAvailable) {
          console.warn('⚠️  Skipping test - Auth Service not available');
          return;
        }

        await request(app.getHttpServer())
          .delete('/api/users/profile')
          .expect(401);
      });

      it('should return 401 for invalid token', async () => {
        const isAuthAvailable = await authHelper.isAuthServiceAvailable();
        if (!isAuthAvailable) {
          console.warn('⚠️  Skipping test - Auth Service not available');
          return;
        }

        await request(app.getHttpServer())
          .delete('/api/users/profile')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);
      });
    });
  });

  describe('Auth Service Integration Health Check', () => {
    it('should verify Auth Service is accessible', async () => {
      const isAvailable = await authHelper.isAuthServiceAvailable();
      
      if (isAvailable) {
        console.log('✅ Auth Service is accessible and responding');
        expect(isAvailable).toBe(true);
      } else {
        console.warn('⚠️  Auth Service is not accessible - integration tests will be skipped');
        // Don't fail the test, just log the warning
        expect(true).toBe(true);
      }
    });

    it('should be able to register and login users via Auth Service', async () => {
      const isAuthAvailable = await authHelper.isAuthServiceAvailable();
      if (!isAuthAvailable) {
        console.warn('⚠️  Skipping test - Auth Service not available');
        return;
      }

      const testUser = authHelper.createTestUser('health-check');
      
      try {
        // Test registration
        console.log('📝 Testing user registration...');
        await authHelper.registerUser(testUser);
        
        // Test login
        console.log('🔐 Testing user login...');
        const tokens = await authHelper.loginUser(testUser.email, testUser.password);
        
        expect(tokens.access_token).toBeDefined();
        expect(tokens.refresh_token).toBeDefined();
        
        // Test token validation
        console.log('✅ Testing token validation...');
        const userData = await authHelper.validateToken(tokens.access_token);
        expect(userData.email).toBe(testUser.email);
        
        console.log('✅ Auth Service integration working correctly');
      } catch (error) {
        console.error('❌ Auth Service integration test failed:', error.message);
        throw error;
      }
    });
  });
});