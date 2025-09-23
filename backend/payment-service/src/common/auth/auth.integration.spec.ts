import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { OrderController } from '../../modules/order/order.controller';
import { OrderService } from '../../modules/order/order.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';

describe('JWT Authentication Integration', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let orderService: OrderService;

  const mockOrderService = {
    createOrder: jest.fn(),
    getUserOrders: jest.fn(),
    getOrder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        JwtStrategy,
        JwtAuthGuard,
        {
          provide: OrderService,
          useValue: mockOrderService,
        },
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

    app = module.createNestApplication();
    await app.init();

    jwtService = module.get<JwtService>(JwtService);
    orderService = module.get<OrderService>(OrderService);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('Protected endpoints', () => {
    it('should reject requests without JWT token', async () => {
      const response = await request(app.getHttpServer()).post('/orders').send({
        gameId: 'game123',
        gameName: 'Test Game',
        amount: 100,
      });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Unauthorized');
    });

    it('should reject requests with invalid JWT token', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', 'Bearer invalid_token')
        .send({
          gameId: 'game123',
          gameName: 'Test Game',
          amount: 100,
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid token');
    });

    it('should reject requests with expired JWT token', async () => {
      // Create an expired token
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxNjAwMDAwMDAxfQ.invalid';

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({
          gameId: 'game123',
          gameName: 'Test Game',
          amount: 100,
        });

      expect(response.status).toBe(401);
    });

    it('should accept requests with valid JWT token', async () => {
      // Mock a successful order creation
      const mockOrder = {
        id: 'order123',
        userId: 'user123',
        gameId: 'game123',
        gameName: 'Test Game',
        amount: 100,
      };
      mockOrderService.createOrder.mockResolvedValue(mockOrder);

      // Create a valid token payload
      const payload = {
        sub: 'user123',
        username: 'testuser',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };

      // For this test, we'll mock the JWT verification to return our payload
      jest.spyOn(jwtService, 'verify').mockReturnValue(payload);

      const validToken = 'valid_jwt_token_here';

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          gameId: 'game123',
          gameName: 'Test Game',
          amount: 100,
        });

      // Note: This test might still fail due to other validation,
      // but it should not fail due to authentication
      expect(response.status).not.toBe(401);
      expect(mockOrderService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          gameId: 'game123',
          gameName: 'Test Game',
          amount: 100,
        }),
        'user123',
      );
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
