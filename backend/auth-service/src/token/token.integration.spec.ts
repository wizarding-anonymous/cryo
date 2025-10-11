import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';
import { RedisService } from '../common/redis/redis.service';
import { AuthDatabaseService } from '../database/auth-database.service';
import { TokenBlacklist } from '../entities/token-blacklist.entity';

describe('TokenService Integration', () => {
  let service: TokenService;
  let jwtService: JwtService;

  const mockRedisService = {
    blacklistToken: jest.fn(),
    isTokenBlacklisted: jest.fn(),
    delete: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
  };

  const mockAuthDatabaseService = {
    blacklistToken: jest.fn(),
    isTokenBlacklisted: jest.fn(),
    blacklistAllUserTokens: jest.fn(),
    getUserBlacklistedTokens: jest.fn(),
    cleanupExpiredTokens: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            secret: configService.get<string>('JWT_SECRET', 'test-secret'),
            signOptions: {
              expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1h'),
            },
          }),
          inject: [ConfigService],
        }),
      ],
      providers: [
        TokenService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: AuthDatabaseService,
          useValue: mockAuthDatabaseService,
        },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Full token lifecycle', () => {
    it('should generate, validate, and blacklist tokens correctly', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };

      // Generate tokens
      const tokens = await service.generateTokens(user);
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBe(3600);

      // Validate the generated access token
      mockRedisService.isTokenBlacklisted.mockResolvedValue(false);
      mockAuthDatabaseService.isTokenBlacklisted.mockResolvedValue(false);

      const validation = await service.validateToken(tokens.accessToken);
      expect(validation.valid).toBe(true);
      expect(validation.payload?.sub).toBe(user.id);
      expect(validation.payload?.email).toBe(user.email);

      // Blacklist the token
      mockAuthDatabaseService.blacklistToken.mockResolvedValue({} as TokenBlacklist);
      mockRedisService.blacklistToken.mockResolvedValue(undefined);

      await service.blacklistToken(tokens.accessToken, user.id, 'logout');

      // Verify blacklisting calls
      expect(mockAuthDatabaseService.blacklistToken).toHaveBeenCalledWith(
        expect.any(String), // token hash
        user.id,
        'logout',
        expect.any(Date), // expiration date
        undefined
      );
      expect(mockRedisService.blacklistToken).toHaveBeenCalledWith(
        tokens.accessToken,
        expect.any(Number) // TTL
      );

      // Validate that blacklisted token is now invalid
      mockRedisService.isTokenBlacklisted.mockResolvedValue(true);

      const blacklistedValidation = await service.validateToken(tokens.accessToken);
      expect(blacklistedValidation.valid).toBe(false);
      expect(blacklistedValidation.reason).toBe('Token is blacklisted');
    });

    it('should handle user-level token invalidation', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };

      // Generate tokens
      const tokens = await service.generateTokens(user);

      // Blacklist all user tokens
      mockAuthDatabaseService.blacklistAllUserTokens.mockResolvedValue(undefined);
      mockRedisService.delete.mockResolvedValue(undefined);
      mockRedisService.set.mockResolvedValue(undefined);

      await service.blacklistAllUserTokens(user.id, 'security', { reason: 'suspicious activity' });

      // Verify calls
      expect(mockAuthDatabaseService.blacklistAllUserTokens).toHaveBeenCalledWith(
        user.id,
        'security',
        { reason: 'suspicious activity' }
      );
      expect(mockRedisService.set).toHaveBeenCalledWith(
        `user_invalidated:${user.id}`,
        'true',
        365 * 24 * 60 * 60
      );

      // Test validation with user check
      mockRedisService.isTokenBlacklisted.mockResolvedValue(false);
      mockAuthDatabaseService.isTokenBlacklisted.mockResolvedValue(false);
      mockRedisService.get.mockResolvedValue('true'); // User tokens invalidated

      const validation = await service.validateTokenWithUserCheck(tokens.accessToken);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('All user tokens have been invalidated');
    });

    it('should handle token expiration correctly', async () => {
      // Create an expired token manually
      const expiredPayload = {
        sub: 'user-123',
        email: 'test@example.com',
      };

      // Create a token that expires immediately
      const expiredToken = await jwtService.signAsync(expiredPayload, { expiresIn: '0s' });
      
      // Wait a moment to ensure it's expired
      await new Promise(resolve => setTimeout(resolve, 100));

      // Try to validate expired token
      const validation = await service.validateToken(expiredToken);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Token expired');

      // Try to blacklist expired token (should not actually blacklist)
      await service.blacklistToken(expiredToken, 'user-123', 'logout');

      // Should not have called database or Redis blacklisting
      expect(mockAuthDatabaseService.blacklistToken).not.toHaveBeenCalled();
      expect(mockRedisService.blacklistToken).not.toHaveBeenCalled();
    });

    it('should decode tokens without verification', () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const payload = { sub: user.id, email: user.email };

      // Create a token
      const token = jwtService.sign(payload);

      // Decode without verification
      const decoded = service.decodeToken(token);
      expect(decoded?.sub).toBe(user.id);
      expect(decoded?.email).toBe(user.email);
      expect(decoded?.exp).toBeDefined();
      expect(decoded?.iat).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle Redis failures gracefully', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const tokens = await service.generateTokens(user);

      // Simulate Redis failure
      mockRedisService.isTokenBlacklisted.mockRejectedValue(new Error('Redis connection failed'));
      mockAuthDatabaseService.isTokenBlacklisted.mockResolvedValue(false);

      // Should still work by falling back to database
      const validation = await service.validateToken(tokens.accessToken);
      expect(validation.valid).toBe(true);
    });

    it('should handle database failures gracefully', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const tokens = await service.generateTokens(user);

      // Simulate both Redis and database failures
      mockRedisService.isTokenBlacklisted.mockRejectedValue(new Error('Redis failed'));
      mockAuthDatabaseService.isTokenBlacklisted.mockRejectedValue(new Error('Database failed'));

      // Should fail open (return false) for availability
      const isBlacklisted = await service.isTokenBlacklisted(tokens.accessToken);
      expect(isBlacklisted).toBe(false);
    });
  });
});