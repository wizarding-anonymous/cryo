import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderService } from './order.service';
import { Order } from './entities/order.entity';
import { NotFoundException } from '@nestjs/common';
import { OrderStatus } from '../../common/enums/order-status.enum';

describe('OrderService', () => {
  let service: OrderService;
  let repository: Repository<Order>;

  const mockOrderRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepository,
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    repository = module.get<Repository<Order>>(getRepositoryToken(Order));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrder', () => {
    it('should create and save an order', async () => {
      const createOrderDto = { gameId: '1', gameName: 'Test Game', amount: 100 };
      const userId = 'user1';
      const order = new Order();
      mockOrderRepository.create.mockReturnValue(order);
      mockOrderRepository.save.mockResolvedValue(order);

      const result = await service.createOrder(createOrderDto, userId);
      expect(mockOrderRepository.create).toHaveBeenCalled();
      expect(mockOrderRepository.save).toHaveBeenCalledWith(order);
      expect(result).toEqual(order);
    });
  });

  describe('getOrder', () => {
    it('should return an order if found', async () => {
      const order = new Order();
      mockOrderRepository.findOne.mockResolvedValue(order);
      const result = await service.getOrder('1', 'user1');
      expect(result).toEqual(order);
    });

    it('should throw NotFoundException if order not found', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);
      await expect(service.getOrder('1', 'user1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateOrderStatus', () => {
    it('should call update on the repository', async () => {
      await service.updateOrderStatus('1', OrderStatus.PAID);
      expect(mockOrderRepository.update).toHaveBeenCalledWith('1', { status: OrderStatus.PAID });
    });
  });
});
