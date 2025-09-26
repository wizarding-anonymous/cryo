import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { ProxyRequestDto } from '../../proxy/dto/proxy-request.dto';
import { ProxyResponseDto } from '../../proxy/dto/proxy-response.dto';
import { ServiceConfigDto } from '../../config/dto/service-config.dto';
import { RouteConfigDto } from '../../routes/dto/route-config.dto';
import { UserDto } from './user.dto';
import { ErrorResponseDto } from './error-response.dto';
import { HealthCheckResultDto } from '../../health/dto/health-check-result.dto';
import { HttpMethod } from '../enums/http-method.enum';
import { ServiceName } from '../enums/service-name.enum';
import { HealthStatus, ServiceHealthStatus } from '../enums/health-status.enum';

describe('DTO Validation Tests', () => {
  describe('ProxyRequestDto', () => {
    it('should validate a valid proxy request', async () => {
      const validRequest = {
        method: HttpMethod.GET,
        url: 'http://example.com/api/test',
        headers: { 'Content-Type': 'application/json' },
        query: { page: '1' }
      };

      const dto = plainToClass(ProxyRequestDto, validRequest);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid URL', async () => {
      const invalidRequest = {
        method: HttpMethod.GET,
        url: 'invalid-url',
        headers: {}
      };

      const dto = plainToClass(ProxyRequestDto, invalidRequest);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('url');
    });
  });

  describe('ProxyResponseDto', () => {
    it('should validate a valid proxy response', async () => {
      const validResponse = {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { message: 'success' },
        executionTime: 150
      };

      const dto = plainToClass(ProxyResponseDto, validResponse);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject negative execution time', async () => {
      const invalidResponse = {
        statusCode: 200,
        headers: {},
        body: {},
        executionTime: -1
      };

      const dto = plainToClass(ProxyResponseDto, invalidResponse);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('executionTime');
    });
  });

  describe('ServiceConfigDto', () => {
    it('should validate a valid service config', async () => {
      const validConfig = {
        name: 'user-service',
        baseUrl: 'http://user-service:3001',
        timeout: 5000,
        retries: 3,
        healthCheckPath: '/health'
      };

      const dto = plainToClass(ServiceConfigDto, validConfig);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid timeout', async () => {
      const invalidConfig = {
        name: 'user-service',
        baseUrl: 'http://user-service:3001',
        timeout: 500, // Less than minimum 1000
        retries: 3,
        healthCheckPath: '/health'
      };

      const dto = plainToClass(ServiceConfigDto, invalidConfig);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('timeout');
    });
  });

  describe('RouteConfigDto', () => {
    it('should validate a valid route config', async () => {
      const validRoute = {
        path: '/api/users/profile',
        method: HttpMethod.GET,
        service: ServiceName.USER,
        requiresAuth: true,
        timeout: 5000
      };

      const dto = plainToClass(RouteConfigDto, validRoute);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid HTTP method', async () => {
      const invalidRoute = {
        path: '/api/users/profile',
        method: 'INVALID_METHOD',
        service: ServiceName.USER,
        requiresAuth: true
      };

      const dto = plainToClass(RouteConfigDto, invalidRoute);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('method');
    });
  });

  describe('UserDto', () => {
    it('should validate a valid user', async () => {
      const validUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        roles: ['user', 'admin'],
        permissions: ['read:games', 'write:profile']
      };

      const dto = plainToClass(UserDto, validUser);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid email', async () => {
      const invalidUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'invalid-email',
        roles: ['user'],
        permissions: ['read:games']
      };

      const dto = plainToClass(UserDto, invalidUser);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
    });
  });

  describe('ErrorResponseDto', () => {
    it('should validate a valid error response', async () => {
      const validError = {
        error: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        statusCode: 400,
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/users/profile',
        service: 'user-service',
        requestId: 'req-123e4567-e89b-12d3-a456-426614174000'
      };

      const dto = plainToClass(ErrorResponseDto, validError);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid status code', async () => {
      const invalidError = {
        error: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        statusCode: 50, // Less than minimum 100
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/users/profile'
      };

      const dto = plainToClass(ErrorResponseDto, invalidError);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('statusCode');
    });
  });

  describe('HealthCheckResultDto', () => {
    it('should validate a valid health check result', async () => {
      const validHealthCheck = {
        status: HealthStatus.OK,
        timestamp: '2024-01-15T10:30:00.000Z',
        uptime: 3600,
        services: [
          {
            name: 'user-service',
            status: ServiceHealthStatus.HEALTHY,
            responseTime: 150,
            lastCheck: '2024-01-15T10:30:00.000Z'
          }
        ]
      };

      const dto = plainToClass(HealthCheckResultDto, validHealthCheck);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject negative uptime', async () => {
      const invalidHealthCheck = {
        status: HealthStatus.OK,
        timestamp: '2024-01-15T10:30:00.000Z',
        uptime: -1, // Negative uptime
        services: []
      };

      const dto = plainToClass(HealthCheckResultDto, invalidHealthCheck);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('uptime');
    });
  });
});