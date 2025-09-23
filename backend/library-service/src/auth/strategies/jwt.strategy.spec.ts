import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UserServiceClient } from '../../clients/user.client';
import { ConfigService } from '@nestjs/config';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let userServiceClient: UserServiceClient;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
      if (key === 'jwt.secret')
        return 'test-secret-key-for-testing-minimum-32-chars';
      return defaultValue || 'default-value';
    }),
  };

  const mockUserServiceClient = {
    doesUserExist: jest.fn(),
  };

  beforeEach(() => {
    configService = mockConfigService as any;
    userServiceClient = mockUserServiceClient as any;
    strategy = new JwtStrategy(configService, userServiceClient);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should validate a valid JWT payload with existing user', async () => {
      const payload = {
        sub: 'user123',
        username: 'testuser',
        roles: ['user'],
        email: 'test@example.com',
      };

      mockUserServiceClient.doesUserExist.mockResolvedValue(true);

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: 'user123',
        username: 'testuser',
        roles: ['user'],
        email: 'test@example.com',
      });
      expect(userServiceClient.doesUserExist).toHaveBeenCalledWith('user123');
    });

    it('should throw UnauthorizedException for invalid payload (missing sub)', async () => {
      const payload = {
        username: 'testuser',
        roles: ['user'],
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(userServiceClient.doesUserExist).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid payload (missing username)', async () => {
      const payload = {
        sub: 'user123',
        roles: ['user'],
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(userServiceClient.doesUserExist).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      const payload = {
        sub: 'user123',
        username: 'testuser',
        roles: ['user'],
      };

      mockUserServiceClient.doesUserExist.mockResolvedValue(false);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(userServiceClient.doesUserExist).toHaveBeenCalledWith('user123');
    });

    it('should fallback to trusting JWT when User Service is unavailable', async () => {
      const payload = {
        sub: 'user123',
        username: 'testuser',
        roles: ['user'],
        email: 'test@example.com',
      };

      mockUserServiceClient.doesUserExist.mockRejectedValue(
        new Error('Network error'),
      );

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: 'user123',
        username: 'testuser',
        roles: ['user'],
        email: 'test@example.com',
      });
    });

    it('should throw UnauthorizedException for non-network errors', async () => {
      const payload = {
        sub: 'user123',
        username: 'testuser',
        roles: ['user'],
      };

      mockUserServiceClient.doesUserExist.mockRejectedValue(
        new Error('User service error'),
      );

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle payload with default empty roles', async () => {
      const payload = {
        sub: 'user123',
        username: 'testuser',
      };

      mockUserServiceClient.doesUserExist.mockResolvedValue(true);

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: 'user123',
        username: 'testuser',
        roles: [],
        email: undefined,
      });
    });
  });
});
