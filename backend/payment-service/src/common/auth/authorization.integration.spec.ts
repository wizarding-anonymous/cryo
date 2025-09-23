import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrderService } from '../../modules/order/order.service';
import { GameCatalogIntegrationService } from '../../integrations/game-catalog/game-catalog.service';
import { Order } from '../../modules/order/entities/order.entity';
import { OrderStatus } from '../enums/order-status.enum';

describe('Authorization Integration Tests', () => {
  let orderService: OrderService;

  const mockOrderRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockGameCatalogService = {
    getGamePurchaseInfo: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepository,
        },
        {
          provide: GameCatalogIntegrationService,
          useValue: mockGameCatalogService,
        },
      ],
    }).compile();

    orderService = module.get<OrderService>(OrderService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Order ownership validation', () => {
    it('should allow user to access their own order', async () => {
      const order = new Order();
      order.id = 'order123';
      order.userId = 'user123';
      order.status = OrderStatus.PENDING;

      mockOrderRepository.findOne.mockResolvedValue(order);

      const result = await orderService.validateOrderOwnership(
        'order123',
        'user123',
      );

      expect(result).toEqual(order);
      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'order123', userId: 'user123' },
      });
    });
  });
});
