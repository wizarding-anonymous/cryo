import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import { AuthValidationService } from './auth-validation.service';
import { ServiceRegistryService } from '../registry/service-registry.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AuthValidationService', () => {
  let service: AuthValidationService;
  let mockRegistry: jest.Mocked<ServiceRegistryService>;

  beforeEach(async () => {
    mockRegistry = {
      getServiceConfig: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthValidationService,
        {
          provide: ServiceRegistryService,
          useValue: mockRegistry,
        },
      ],
    }).compile();

    service = module.get<AuthValidationService>(AuthValidationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateBearerToken', () => {
    it('should validate a valid token and return user', async () => {
      const mockUserData = {
        id: 'user123',
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['read'],
      };

      mockRegistry.getServiceConfig.mockReturnValue({
        baseUrl: 'http://user-service',
        timeout: 5000,
      } as any);

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: mockUserData,
      });

      const result = await service.validateBearerToken('Bearer valid-token');

      expect(result).toEqual({
        id: 'user123',
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['read'],
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://user-service/api/profile',
        {
          headers: { Authorization: 'Bearer valid-token' },
          timeout: 5000,
          validateStatus: expect.any(Function),
        },
      );
    });

    it('should throw UnauthorizedException when token is missing', async () => {
      await expect(service.validateBearerToken()).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateBearerToken('')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user service is not configured', async () => {
      mockRegistry.getServiceConfig.mockReturnValue(undefined);

      await expect(
        service.validateBearerToken('Bearer token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user service returns 401', async () => {
      mockRegistry.getServiceConfig.mockReturnValue({
        baseUrl: 'http://user-service',
        timeout: 5000,
      } as any);

      mockedAxios.get.mockResolvedValue({
        status: 401,
        data: null,
      });

      await expect(
        service.validateBearerToken('Bearer invalid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user service returns invalid data', async () => {
      mockRegistry.getServiceConfig.mockReturnValue({
        baseUrl: 'http://user-service',
        timeout: 5000,
      } as any);

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { email: 'test@example.com' }, // missing id
      });

      await expect(
        service.validateBearerToken('Bearer token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should handle axios errors gracefully', async () => {
      mockRegistry.getServiceConfig.mockReturnValue({
        baseUrl: 'http://user-service',
        timeout: 5000,
      } as any);

      mockedAxios.get.mockRejectedValue({
        response: { status: 401 },
      });

      await expect(
        service.validateBearerToken('Bearer token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should handle network errors', async () => {
      mockRegistry.getServiceConfig.mockReturnValue({
        baseUrl: 'http://user-service',
        timeout: 5000,
      } as any);

      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      await expect(
        service.validateBearerToken('Bearer token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should handle alternative user data formats', async () => {
      mockRegistry.getServiceConfig.mockReturnValue({
        baseUrl: 'http://user-service/',
        timeout: 5000,
      } as any);

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {
          userId: 'user456', // alternative id field
          email: 'alt@example.com',
          roles: null, // null roles
          permissions: undefined, // undefined permissions
        },
      });

      const result = await service.validateBearerToken('Bearer token');

      expect(result).toEqual({
        id: 'user456',
        email: 'alt@example.com',
        roles: [],
        permissions: [],
      });
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const token = service.extractTokenFromHeader('Bearer abc123');
      expect(token).toBe('abc123');
    });

    it('should return undefined for invalid headers', () => {
      expect(service.extractTokenFromHeader()).toBeUndefined();
      expect(service.extractTokenFromHeader('')).toBeUndefined();
      expect(service.extractTokenFromHeader('Basic abc123')).toBeUndefined();
      expect(service.extractTokenFromHeader('Bearer')).toBeUndefined();
      expect(service.extractTokenFromHeader('bearer abc123')).toBe('abc123'); // case insensitive
    });

    it('should handle malformed headers', () => {
      expect(service.extractTokenFromHeader('InvalidHeader')).toBeUndefined();
      expect(service.extractTokenFromHeader('Bearer ')).toBeUndefined();
      expect(service.extractTokenFromHeader(' Bearer token')).toBeUndefined();
    });
  });
});