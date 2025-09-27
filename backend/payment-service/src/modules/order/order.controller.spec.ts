import { Test, TestingModule } from '@nestjs/testing';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
import { Order } from './entities/order.entity';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { PaymentCacheInterceptor } from '../../common/interceptors/payment-cache.interceptor';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('OrderController', () => {
  let controller: OrderController;
  let orderService: OrderService;

  const mockOrderService = {
    createOrder: jest.fn(),
    getUserOrders: jest.fn(),
    getOrder: jest.fn(),
  };

  const mockJwtAuthGuard = {
    canActivate: jest.fn(() => true),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        {
          provide: OrderService,
          useValue: mockOrderService,
        },
        PaymentCacheInterceptor,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<OrderController>(OrderController);
    orderService = module.get<OrderService>(OrderService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new order', async () => {
      const createOrderDto: CreateOrderDto = {
        gameId: 'test-game-id',
      };

      const mockOrder: Partial<Order> = {
        id: 'test-order-id',
        gameId: createOrderDto.gameId,
        gameName: 'Test Game', // This will be fetched from Game Catalog Service
        amount: 1999.99, // This will be fetched from Game Catalog Service
        currency: 'RUB',
        status: OrderStatus.PENDING,
      };

      const mockRequest = {
        user: { userId: 'test-user-id' },
      };

      mockOrderService.createOrder.mockResolvedValue(mockOrder);

      const result = await controller.create(createOrderDto, mockRequest);

      expect(orderService.createOrder).toHaveBeenCalledWith(
        createOrderDto,
        'test-user-id',
      );
      expect(result).toEqual(mockOrder);
    });
  });

  describe('findAll', () => {
    it('should return user orders', async () => {
      const query: GetOrdersQueryDto = {
        page: 1,
        limit: 10,
        status: OrderStatus.PENDING,
      };

      const mockOrders: Partial<Order>[] = [
        {
          id: 'test-order-1',
          gameId: 'test-game-1',
          gameName: 'Test Game 1',
          amount: 1999.99,
          status: OrderStatus.PENDING,
        },
      ];

      const mockRequest = {
        user: { userId: 'test-user-id' },
      };

      mockOrderService.getUserOrders.mockResolvedValue(mockOrders);

      const result = await controller.findAll(query, mockRequest);

      expect(orderService.getUserOrders).toHaveBeenCalledWith(
        query,
        'test-user-id',
      );
      expect(result).toEqual(mockOrders);
    });
  });

  describe('findOne', () => {
    it('should return a specific order', async () => {
      const orderId = 'test-order-id';
      const mockOrder: Partial<Order> = {
        id: orderId,
        gameId: 'test-game-id',
        gameName: 'Test Game',
        amount: 1999.99,
        status: OrderStatus.PENDING,
      };

      const mockRequest = {
        user: { userId: 'test-user-id' },
      };

      mockOrderService.getOrder.mockResolvedValue(mockOrder);

      const result = await controller.findOne(orderId, mockRequest);

      expect(orderService.getOrder).toHaveBeenCalledWith(
        orderId,
        'test-user-id',
      );
      expect(result).toEqual(mockOrder);
    });
  });
});
