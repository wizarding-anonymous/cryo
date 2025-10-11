import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import * as request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CustomThrottlerGuard } from '../common/guards/custom-throttler.guard';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';

describe('AuthController Throttling (e2e)', () => {
  let app: INestApplication;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    validateUser: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    validateToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            name: 'short',
            ttl: 1000, // 1 second
            limit: 2, // Reduced for testing
          },
          {
            name: 'auth-strict',
            ttl: 5000, // 5 seconds for testing
            limit: 2, // 2 attempts per 5 seconds for testing
          },
        ]),
      ],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: APP_GUARD,
          useClass: CustomThrottlerGuard,
        },
        {
          provide: APP_FILTER,
          useClass: GlobalExceptionFilter,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    authService = module.get<AuthService>(AuthService);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should allow requests within rate limit', async () => {
      mockAuthService.register.mockResolvedValue({
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
        access_token: 'token',
        refresh_token: 'refresh',
        session_id: 'session',
        expires_in: 3600,
      });

      const registerDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'StrongPass123!',
      };

      // First request should succeed
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      // Second request should succeed
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...registerDto, email: 'test2@example.com' })
        .expect(201);
    });

    it('should block requests exceeding rate limit', async () => {
      const registerDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'StrongPass123!',
      };

      mockAuthService.register.mockResolvedValue({
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
        access_token: 'token',
        refresh_token: 'refresh',
        session_id: 'session',
        expires_in: 3600,
      });

      // Make requests up to the limit
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...registerDto, email: 'test2@example.com' })
        .expect(201);

      // Third request should be rate limited
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...registerDto, email: 'test3@example.com' })
        .expect(429);

      expect(response.body.message).toContain('Слишком много попыток аутентификации');
    });
  });

  describe('POST /auth/login', () => {
    it('should allow requests within rate limit', async () => {
      mockAuthService.validateUser.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      });

      mockAuthService.login.mockResolvedValue({
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
        access_token: 'token',
        refresh_token: 'refresh',
        session_id: 'session',
        expires_in: 3600,
      });

      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      // First request should succeed
      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200);

      // Second request should succeed
      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200);
    });

    it('should block requests exceeding rate limit with Russian message', async () => {
      mockAuthService.validateUser.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      });

      mockAuthService.login.mockResolvedValue({
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
        access_token: 'token',
        refresh_token: 'refresh',
        session_id: 'session',
        expires_in: 3600,
      });

      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      // Make requests up to the limit
      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200);

      // Third request should be rate limited
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(429);

      expect(response.body.message).toContain('Слишком много попыток аутентификации');
      expect(response.body.statusCode).toBe(429);
    });
  });

  describe('POST /auth/validate', () => {
    it('should allow high frequency requests for service-to-service calls', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        user: { id: '1', email: 'test@example.com' },
      });

      const validateDto = {
        token: 'valid-jwt-token',
      };

      // Should allow multiple rapid requests for service validation
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer())
          .post('/auth/validate')
          .send(validateDto)
          .expect(200);
      }
    });
  });

  describe('Rate limit error format', () => {
    it('should return proper error structure for rate limited requests', async () => {
      mockAuthService.validateUser.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      });

      mockAuthService.login.mockResolvedValue({
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
        access_token: 'token',
        refresh_token: 'refresh',
        session_id: 'session',
        expires_in: 3600,
      });

      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      // Exhaust rate limit
      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto);

      // Check error response structure
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(429);

      expect(response.body).toHaveProperty('statusCode', 429);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('path', '/auth/login');
      expect(response.body).toHaveProperty('method', 'POST');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Слишком много попыток аутентификации');
    });
  });
});