import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy, JwtPayload } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') {
                return 'test_secret';
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return the user payload for valid token', async () => {
      const payload: JwtPayload = {
        sub: 'user123',
        username: 'testuser',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: 'user123',
        username: 'testuser',
      });
    });

    it('should throw UnauthorizedException when sub is missing', async () => {
      const payload = { username: 'testuser' } as JwtPayload;

      await expect(strategy.validate(payload)).rejects.toThrow(
        new UnauthorizedException('Invalid token payload'),
      );
    });

    it('should throw UnauthorizedException when username is missing', async () => {
      const payload = { sub: 'user123' } as JwtPayload;

      await expect(strategy.validate(payload)).rejects.toThrow(
        new UnauthorizedException('Invalid token payload'),
      );
    });

    it('should throw UnauthorizedException when both sub and username are missing', async () => {
      const payload = {} as JwtPayload;

      await expect(strategy.validate(payload)).rejects.toThrow(
        new UnauthorizedException('Invalid token payload'),
      );
    });

    it('should handle empty string values', async () => {
      const payload: JwtPayload = { sub: '', username: '' };

      await expect(strategy.validate(payload)).rejects.toThrow(
        new UnauthorizedException('Invalid token payload'),
      );
    });

    it('should handle null values', async () => {
      const payload: JwtPayload = { sub: null as any, username: null as any };

      await expect(strategy.validate(payload)).rejects.toThrow(
        new UnauthorizedException('Invalid token payload'),
      );
    });
  });

  describe('configuration', () => {
    it('should use JWT_SECRET from config service', () => {
      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
    });
  });
});
