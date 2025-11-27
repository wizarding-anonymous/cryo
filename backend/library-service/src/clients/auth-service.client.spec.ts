import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AuthServiceClient } from './auth-service.client';
import { Observable } from 'rxjs';
import { AxiosResponse } from 'axios';

describe('AuthServiceClient', () => {
  let client: AuthServiceClient;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockHttpService = {
      post: jest.fn(),
      get: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthServiceClient,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    client = module.get<AuthServiceClient>(AuthServiceClient);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);

    // Setup default config values
    configService.get.mockImplementation((key: string, defaultValue?: unknown) => {
      const config: Record<string, unknown> = {
        'auth.service.url': 'http://auth-service:3001',
        'auth.service.timeout': 5000,
        'auth.service.retryAttempts': 3,
        'auth.service.internalKey': 'test-internal-key',
      };
      return config[key] || defaultValue;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(client).toBeDefined();
    });

    it('should initialize with correct configuration', () => {
      expect(configService.get).toHaveBeenCalledWith(
        'auth.service.url',
        'http://auth-service:3001',
      );
      expect(configService.get).toHaveBeenCalledWith(
        'auth.service.timeout',
        5000,
      );
      expect(configService.get).toHaveBeenCalledWith(
        'auth.service.retryAttempts',
        3,
      );
      expect(configService.get).toHaveBeenCalledWith(
        'auth.service.internalKey',
        '',
      );
    });
  });

  describe('validateToken', () => {
    it('should call httpService.post with correct parameters', async () => {
      const request = {
        token: 'test-token',
        requiredPermissions: ['read:library'],
      };

      // Mock the RxJS chain to throw an error so we can test the error handling
      const mockObservable = {
        pipe: jest.fn().mockReturnValue({
          then: jest.fn().mockRejectedValue(new Error('Network error')),
        }),
      } as unknown as Observable<AxiosResponse>;

      httpService.post.mockReturnValue(mockObservable);

      try {
        await client.validateToken(request);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    });
  });

  describe('validateInternalService', () => {
    it('should call httpService.post with correct parameters', async () => {
      const request = {
        serviceId: 'user-service',
        targetService: 'library-service',
        action: 'get:/library',
      };

      // Mock the RxJS chain to throw an error so we can test the error handling
      const mockObservable = {
        pipe: jest.fn().mockReturnValue({
          then: jest.fn().mockRejectedValue(new Error('Network error')),
        }),
      } as unknown as Observable<AxiosResponse>;

      httpService.post.mockReturnValue(mockObservable);

      try {
        await client.validateInternalService(request);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    });
  });

  describe('healthCheck', () => {
    it('should return false on error', async () => {
      const mockObservable = {
        pipe: jest.fn().mockReturnValue({
          then: jest.fn().mockRejectedValue(new Error('Network error')),
        }),
      } as unknown as Observable<AxiosResponse>;

      httpService.get.mockReturnValue(mockObservable);

      const result = await client.healthCheck();
      expect(result).toBe(false);
    });
  });
});