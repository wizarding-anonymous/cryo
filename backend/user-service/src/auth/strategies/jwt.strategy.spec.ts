import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { RedisService } from '../../common/redis/redis.service';
import { Request } from 'express';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let redisService: jest.Mocked<RedisService>;

  const mockJwtPayload = {
    sub: 'user-123',
    email: 'test@example.com',
  };

  const mockRequest = {
    headers: {
      authorization: 'Bearer valid-jwt-token',
    },
  } as Request;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue('test-jwt-secret'),
    };

    const mockRedisService = {
      isTokenBlacklisted: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    redisService = module.get(RedisService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user data when token is valid and not blacklisted', async () => {
      // Arrange
      redisService.isTokenBlacklisted.mockResolvedValue(false);

      // Act
      const result = await strategy.validate(mockRequest, mockJwtPayload);

      // Assert
      expect(result).toEqual({
        userId: mockJwtPayload.sub,
        email: mockJwtPayload.email,
      });
      expect(redisService.isTokenBlacklisted).toHaveBeenCalledWith(
        'valid-jwt-token',
      );
    });

    it('should throw UnauthorizedException when token is blacklisted', async () => {
      // Arrange
      redisService.isTokenBlacklisted.mockResolvedValue(true);

      // Act & Assert
      await expect(
        strategy.validate(mockRequest, mockJwtPayload),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        strategy.validate(mockRequest, mockJwtPayload),
      ).rejects.toThrow('Токен недействителен (в черном списке)');
      expect(redisService.isTokenBlacklisted).toHaveBeenCalledWith(
        'valid-jwt-token',
      );
    });

    it('should handle missing authorization header gracefully', async () => {
      // Arrange
      const requestWithoutAuth = {
        headers: {},
      } as Request;

      // Act
      const result = await strategy.validate(
        requestWithoutAuth,
        mockJwtPayload,
      );

      // Assert
      expect(result).toEqual({
        userId: mockJwtPayload.sub,
        email: mockJwtPayload.email,
      });
      expect(redisService.isTokenBlacklisted).not.toHaveBeenCalled();
    });

    it('should handle malformed authorization header', async () => {
      // Arrange
      const requestWithMalformedAuth = {
        headers: {
          authorization: 'InvalidFormat',
        },
      } as Request;

      // Act
      const result = await strategy.validate(
        requestWithMalformedAuth,
        mockJwtPayload,
      );

      // Assert
      expect(result).toEqual({
        userId: mockJwtPayload.sub,
        email: mockJwtPayload.email,
      });
      expect(redisService.isTokenBlacklisted).toHaveBeenCalledWith(undefined);
    });

    it('should handle Redis service errors gracefully', async () => {
      // Arrange
      const error = new Error('Redis connection failed');
      redisService.isTokenBlacklisted.mockRejectedValue(error);

      // Act & Assert
      await expect(
        strategy.validate(mockRequest, mockJwtPayload),
      ).rejects.toThrow(error);
      expect(redisService.isTokenBlacklisted).toHaveBeenCalledWith(
        'valid-jwt-token',
      );
    });

    it('should extract token correctly from Bearer authorization header', async () => {
      // Arrange
      const requestWithBearerToken = {
        headers: {
          authorization: 'Bearer my-jwt-token-123',
        },
      } as Request;
      redisService.isTokenBlacklisted.mockResolvedValue(false);

      // Act
      await strategy.validate(requestWithBearerToken, mockJwtPayload);

      // Assert
      expect(redisService.isTokenBlacklisted).toHaveBeenCalledWith(
        'my-jwt-token-123',
      );
    });

    it('should return correct user data structure', async () => {
      // Arrange
      const customPayload = {
        sub: 'user-456',
        email: 'custom@example.com',
      };
      redisService.isTokenBlacklisted.mockResolvedValue(false);

      // Act
      const result = await strategy.validate(mockRequest, customPayload);

      // Assert
      expect(result).toEqual({
        userId: 'user-456',
        email: 'custom@example.com',
      });
      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('email');
      expect(Object.keys(result)).toHaveLength(2);
    });
  });
});
