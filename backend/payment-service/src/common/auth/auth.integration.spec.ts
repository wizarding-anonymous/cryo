import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';

describe('JWT Authentication Integration', () => {
  let jwtService: JwtService;
  let jwtStrategy: JwtStrategy;
  let jwtAuthGuard: JwtAuthGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        JwtAuthGuard,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') {
                return 'test_secret_key_for_integration_tests';
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    jwtService = module.get<JwtService>(JwtService);
    jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
    jwtAuthGuard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('JWT Components Integration', () => {
    it('should have JwtStrategy defined', () => {
      expect(jwtStrategy).toBeDefined();
    });

    it('should have JwtAuthGuard defined', () => {
      expect(jwtAuthGuard).toBeDefined();
    });

    it('should have JwtService defined', () => {
      expect(jwtService).toBeDefined();
    });
  });

  describe('JWT payload validation', () => {
    it('should extract user information from valid JWT payload', () => {
      const strategy = new JwtStrategy(
        new ConfigService({
          JWT_SECRET: 'test_secret',
        }),
      );

      const payload = {
        sub: 'user123',
        username: 'testuser',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const result = strategy.validate(payload);

      expect(result).resolves.toEqual({
        userId: 'user123',
        username: 'testuser',
      });
    });

    it('should reject JWT payload with missing sub', async () => {
      const strategy = new JwtStrategy(
        new ConfigService({
          JWT_SECRET: 'test_secret',
        }),
      );

      const payload = {
        username: 'testuser',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      } as any;

      await expect(strategy.validate(payload)).rejects.toThrow(
        'Invalid token payload',
      );
    });

    it('should reject JWT payload with missing username', async () => {
      const strategy = new JwtStrategy(
        new ConfigService({
          JWT_SECRET: 'test_secret',
        }),
      );

      const payload = {
        sub: 'user123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      } as any;

      await expect(strategy.validate(payload)).rejects.toThrow(
        'Invalid token payload',
      );
    });
  });
});
