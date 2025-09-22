import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderService } from './order.service';
import { Order } from './entities/order.entity';
import { GameCatalogIntegrationService } from '../../integrations/game-catalog/game-catalog.service';
import { OrderNotFoundException } from '../../common/exceptions/order-not-found.exception';
import { BadRequestException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { GamePurchaseInfo } from '../../integrations/game-catalog/dto/game-purchase-info.dto';

describe('OrderService', () => {
  let service: OrderService;
  let repository: Repository<Order>;
  let gameCatalogService: GameCatalogIntegrationService;

  const mockOrderRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
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

    service = module.get<OrderService>(OrderService);
    repository = module.get<Repository<Order>>(getRepositoryToken(Order));
    gameCatalogService = module.get<GameCatalogIntegrationService>(
      GameCatalogIntegrationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrder', () => {
    const createOrderDto: CreateOrderDto = {
      gameId: 'valid-game-id',
      gameName: 'Test Game',
      amount: 100
    };
    const userId = 'user-id';
    const gameInfo: GamePurchaseInfo = {
      id: 'valid-game-id',
      title: 'Test Game',
      price: 100,
      currency: 'RUB',
      available: true,
    };

    it('should create an order when game is available', async () => {
      mockGameCatalogService.getGamePurchaseInfo.mockResolvedValue(gameInfo);
      const expectedOrder = new Order();
      mockOrderRepository.create.mockReturnValue(expectedOrder);
      mockOrderRepository.save.mockResolvedValue(expectedOrder);

      const result = await service.createOrder(createOrderDto, userId);

      expect(gameCatalogService.getGamePurchaseInfo).toHaveBeenCalledWith(
        createOrderDto.gameId,
      );
      expect(mockOrderRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          gameId: gameInfo.id,
          gameName: gameInfo.title,
          amount: gameInfo.price,
        }),
      );
      expect(mockOrderRepository.save).toHaveBeenCalledWith(expectedOrder);
      expect(result).toEqual(expectedOrder);
    });

    it('should throw BadRequestException if game not found', async () => {
      mockGameCatalogService.getGamePurchaseInfo.mockResolvedValue(null);
      await expect(service.createOrder(createOrderDto, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if game is not available', async () => {
      const unavailableGameInfo = { ...gameInfo, available: false };
      mockGameCatalogService.getGamePurchaseInfo.mockResolvedValue(
        unavailableGameInfo,
      );
      await expect(service.createOrder(createOrderDto, userId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getOrder', () => {
    it('should return an order if found', async () => {
      const order = new Order();
      order.userId = 'user1';
      mockOrderRepository.findOne.mockResolvedValue(order);
      const result = await service.getOrder('1', 'user1');
      expect(result).toEqual(order);
    });

    it('should throw OrderNotFoundException if order not found', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);
      await expect(service.getOrder('1', 'user1')).rejects.toThrow(
        OrderNotFoundException,
      );
    });

    it('should return order when no userId provided (admin access)', async () => {
      const order = new Order();
      order.userId = 'user1';
      mockOrderRepository.findOne.mockResolvedValue(order);
      const result = await service.getOrder('1');
      expect(result).toEqual(order);
      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' }
      });
    });

    it('should throw OrderNotFoundException when user tries to access another users order', async () => {
      const order = new Order();
      order.userId = 'user2';
      mockOrderRepository.findOne.mockResolvedValue(order);
      
      await expect(service.getOrder('1', 'user1')).rejects.toThrow(
        OrderNotFoundException,
      );
    });
  });

  describe('validateOrderOwnership', () => {
    it('should return order when user owns the order', async () => {
      const order = new Order();
      order.id = 'order1';
      order.userId = 'user1';
      mockOrderRepository.findOne.mockResolvedValue(order);

      const result = await service.validateOrderOwnership('order1', 'user1');

      expect(result).toEqual(order);
      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'order1', userId: 'user1' }
      });
    });

    it('should throw OrderNotFoundException when order does not exist', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);

      await expect(service.validateOrderOwnership('order1', 'user1')).rejects.toThrow(
        OrderNotFoundException,
      );
    });

    it('should throw OrderNotFoundException when user does not own the order', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);

      await expect(service.validateOrderOwnership('order1', 'user2')).rejects.toThrow(
        OrderNotFoundException,
      );
    });

    it('should call repository with correct parameters', async () => {
      const order = new Order();
      mockOrderRepository.findOne.mockResolvedValue(order);

      await service.validateOrderOwnership('order123', 'user456');

      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'order123', userId: 'user456' }
      });
    });
  });
});
