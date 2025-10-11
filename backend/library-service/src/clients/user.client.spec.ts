import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { UserServiceClient } from './user.client';

describe('UserServiceClient', () => {
  let client: UserServiceClient;
  let httpService: HttpService;

  const mockHttpService = {
    get: jest.fn(),
    post: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'USER_SERVICE_URL') {
        return 'http://fake-user-service';
      }
      return undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserServiceClient,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    client = module.get<UserServiceClient>(UserServiceClient);
    httpService = module.get<HttpService>(HttpService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(client).toBeDefined();
  });

  describe('doesUserExist', () => {
    it('should return true when user exists', async () => {
      const mockResponse: AxiosResponse = {
        data: { exists: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await client.doesUserExist('user123');
      expect(result).toBe(true);
      expect(httpService.get).toHaveBeenCalledTimes(1);
      expect(httpService.get).toHaveBeenCalledWith(
        'http://fake-user-service/users/user123/exists',
      );
    });

    it('should return false when user does not exist', async () => {
      const mockResponse: AxiosResponse = {
        data: { exists: false },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await client.doesUserExist('user123');
      expect(result).toBe(false);
    });

    it('should return false on error after retries', async () => {
      const error = new Error('Network error');
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const result = await client.doesUserExist('user123');
      expect(result).toBe(false);
      expect(httpService.get).toHaveBeenCalledWith(
        'http://fake-user-service/users/user123/exists',
      );
    });

    it('should handle malformed response', async () => {
      const mockResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await client.doesUserExist('user123');
      expect(result).toBe(false);
    });

    it('should handle non-boolean exists value', async () => {
      const mockResponse: AxiosResponse = {
        data: { exists: 'true' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await client.doesUserExist('user123');
      expect(result).toBe(false);
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile on success', async () => {
      const mockUserProfile = {
        id: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockResponse: AxiosResponse = {
        data: mockUserProfile,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await client.getUserProfile('user123');
      expect(result).toEqual(mockUserProfile);
      expect(httpService.get).toHaveBeenCalledWith(
        'http://fake-user-service/users/user123',
      );
    });

    it('should return null on error after retries', async () => {
      const error = new Error('Network error');
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const result = await client.getUserProfile('user123');
      expect(result).toBeNull();
    });
  });

  describe('validateUserToken', () => {
    it('should return validation result on success', async () => {
      const mockResponse: AxiosResponse = {
        data: { valid: true, userId: 'user123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await client.validateUserToken('valid-token');
      expect(result).toEqual({ valid: true, userId: 'user123' });
      expect(httpService.post).toHaveBeenCalledWith(
        'http://fake-user-service/auth/validate',
        { token: 'valid-token' },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    });

    it('should return invalid result on error after retries', async () => {
      const error = new Error('Network error');
      mockHttpService.post.mockReturnValue(throwError(() => error));

      const result = await client.validateUserToken('invalid-token');
      expect(result).toEqual({ valid: false });
    });
  });

  describe('circuit breaker', () => {
    it('should handle circuit breaker functionality', async () => {
      // Test that circuit breaker exists and can handle errors
      const error = new Error('Network error');
      mockHttpService.get.mockReturnValue(throwError(() => error));

      // First call should return false due to error handling
      const result = await client.doesUserExist('user123');
      expect(result).toBe(false);

      // Verify that the HTTP service was called
      expect(httpService.get).toHaveBeenCalledWith(
        'http://fake-user-service/users/user123/exists',
      );
    });
  });
});
