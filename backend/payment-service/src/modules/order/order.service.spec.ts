import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { OrderService } from './order.service';
import { Order } from './entities/order.entity';
import { GameCatalogIntegrationService } from '../../integrations/game-catalog/game-catalog.service';
import { OrderNotFoundException } from '../../common/exceptions/order-not-found.exception';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';

describe('OrderService', () => {
  let service: OrderService;
  let orderRepository: jest.Mocked<Repository<Order>>;
  let gameCatalogService: jest.Mocked<GameCatalogIntegrationService>;

  const mockOrder: Order = {
    id: 'order-123',
    userId: 'user-123',
    gameId: 'game-123',
    gameName: 'Test Game',
    amount: 1999,
    currency: 'RUB',
    status: OrderStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  };

  const mockGameInfo = {
    id: 'game-123',
    title: 'Test Game',
    price: 1999,
    currency: 'RUB',
    available: true,
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockGameCatalogService = {
      getGamePurchaseInfo: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getRepositoryToken(Order),
          useValue: mockRepository,
        },
        {
          provide: GameCatalogIntegrationService,
          useValue: mockGameCatalogService,
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    orderRepository = module.get(getRepositoryToken(Order));
    gameCatalogService = module.get(GameCatalogIntegrationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrder', () => {
    const createOrderDto: CreateOrderDto = {
      gameId: 'game-123',
    };

    it('should create an order successfully', async () => {
      gameCatalogService.getGamePurchaseInfo.mockResolvedValue(mockGameInfo);
      orderRepository.create.mockReturnValue(mockOrder);
      orderRepository.save.mockResolvedValue(mockOrder);

      const result = await service.createOrder(createOrderDto, 'user-123');

      expect(gameCatalogService.getGamePurchaseInfo).toHaveBeenCalledWith(
        'game-123',
      );
      expect(orderRepository.create).toHaveBeenCalledWith({
        userId: 'user-123',
        gameId: 'game-123',
        gameName: 'Test Game',
        amount: 1999,
        currency: 'RUB',
        status: OrderStatus.PENDING,
        expiresAt: expect.any(Date),
      });
      expect(orderRepository.save).toHaveBeenCalledWith(mockOrder);
      expect(result).toEqual(mockOrder);
    });

    it('should throw BadRequestException when game is not found', async () => {
      gameCatalogService.getGamePurchaseInfo.mockResolvedValue(null);

      await expect(
        service.createOrder(createOrderDto, 'user-123'),
      ).rejects.toThrow(BadRequestException);
      expect(gameCatalogService.getGamePurchaseInfo).toHaveBeenCalledWith(
        'game-123',
      );
    });

    it('should throw BadRequestException when game is not available', async () => {
      const unavailableGame = { ...mockGameInfo, available: false };
      gameCatalogService.getGamePurchaseInfo.mockResolvedValue(unavailableGame);

      await expect(
        service.createOrder(createOrderDto, 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUserOrders', () => {
    const queryDto: GetOrdersQueryDto = {
      page: 1,
      limit: 10,
      status: OrderStatus.PENDING,
    };

    it('should return user orders with pagination', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockOrder], 1]),
      };

      orderRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );

      const result = await service.getUserOrders(queryDto, 'user-123');

      expect(orderRepository.createQueryBuilder).toHaveBeenCalledWith('order');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'order.userId = :userId',
        {
          userId: 'user-123',
        },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'order.status = :status',
        {
          status: OrderStatus.PENDING,
        },
      );
      expect(result).toEqual({ data: [mockOrder], total: 1 });
    });

    it('should return orders without status filter', async () => {
      const queryWithoutStatus = { page: 1, limit: 10 };
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockOrder], 1]),
      };

      orderRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );

      await service.getUserOrders(queryWithoutStatus, 'user-123');

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('getOrder', () => {
    it('should return order when found', async () => {
      orderRepository.findOne.mockResolvedValue(mockOrder);

      const result = await service.getOrder('order-123', 'user-123');

      expect(orderRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'order-123', userId: 'user-123' },
      });
      expect(result).toEqual(mockOrder);
    });

    it('should throw OrderNotFoundException when order not found', async () => {
      orderRepository.findOne.mockResolvedValue(null);

      await expect(service.getOrder('order-123', 'user-123')).rejects.toThrow(
        OrderNotFoundException,
      );
    });

    it('should return order without userId check when userId not provided', async () => {
      orderRepository.findOne.mockResolvedValue(mockOrder);

      const result = await service.getOrder('order-123');

      expect(orderRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'order-123' },
      });
      expect(result).toEqual(mockOrder);
    });
  });

  describe('validateOrderOwnership', () => {
    it('should return order when user owns it', async () => {
      orderRepository.findOne.mockResolvedValue(mockOrder);

      const result = await service.validateOrderOwnership(
        'order-123',
        'user-123',
      );

      expect(orderRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'order-123', userId: 'user-123' },
      });
      expect(result).toEqual(mockOrder);
    });

    it('should throw OrderNotFoundException when user does not own order', async () => {
      orderRepository.findOne.mockResolvedValue(null);

      await expect(
        service.validateOrderOwnership('order-123', 'user-456'),
      ).rejects.toThrow(OrderNotFoundException);
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      orderRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.updateOrderStatus('order-123', OrderStatus.PAID);

      expect(orderRepository.update).toHaveBeenCalledWith('order-123', {
        status: OrderStatus.PAID,
      });
    });
  });
});
