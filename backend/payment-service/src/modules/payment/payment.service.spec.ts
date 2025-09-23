import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { OrderService } from '../order/order.service';
import { PaymentProviderService } from './payment-provider.service';
import { LibraryIntegrationService } from '../../integrations/library/library.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Order } from '../order/entities/order.entity';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { PaymentProvider } from '../../common/enums/payment-provider.enum';
import { PaymentEventsService } from './payment-events.service';

describe('PaymentService', () => {
  let service: PaymentService;
  let repository: Repository<Payment>;
  let orderService: OrderService;

  const mockPaymentRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockOrderService = {
    getOrder: jest.fn(),
    updateOrderStatus: jest.fn(),
    validateOrderOwnership: jest.fn(),
  };

  const mockPaymentProviderService = {
    processPayment: jest.fn(),
  };

  const mockLibraryService = {
    addGameToLibrary: jest.fn(),
  };

  const mockMetricsService = {
    incrementCounter: jest.fn(),
    recordHistogram: jest.fn(),
    recordPayment: jest.fn(),
  };

  const mockPaymentEventsService = {
    publishPaymentCompleted: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepository,
        },
        {
          provide: OrderService,
          useValue: mockOrderService,
        },
        {
          provide: PaymentProviderService,
          useValue: mockPaymentProviderService,
        },
        {
          provide: LibraryIntegrationService,
          useValue: mockLibraryService,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
        {
          provide: PaymentEventsService,
          useValue: mockPaymentEventsService,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    repository = module.get<Repository<Payment>>(getRepositoryToken(Payment));
    orderService = module.get<OrderService>(OrderService);
  });

  describe('cancelPayment', () => {
    it('should cancel payment and update order status', async () => {
      const payment = {
        id: 'payment2',
        orderId: 'order2',
        status: PaymentStatus.PROCESSING,
        provider: PaymentProvider.SBERBANK,
      } as Payment;
      const cancelled = {
        ...payment,
        status: PaymentStatus.CANCELLED,
      } as Payment;

      mockPaymentRepository.findOne.mockResolvedValue(payment);
      mockPaymentRepository.save.mockResolvedValue(cancelled);

      const result = await service.cancelPayment('payment2');

      expect(mockPaymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentStatus.CANCELLED }),
      );
      expect(mockOrderService.updateOrderStatus).toHaveBeenCalledWith(
        'order2',
        OrderStatus.CANCELLED,
      );
      expect(result).toBe(cancelled);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPayment', () => {
    it('should create a payment if order is pending', async () => {
      const order = {
        id: 'order1',
        status: OrderStatus.PENDING,
        amount: 100,
        currency: 'RUB',
      } as Order;
      mockOrderService.validateOrderOwnership.mockResolvedValue(order);
      mockPaymentRepository.findOne.mockResolvedValue(null); // No existing payment
      const payment = new Payment();
      mockPaymentRepository.create.mockReturnValue(payment);
      mockPaymentRepository.save.mockResolvedValue(payment);

      const dto = { orderId: 'order1', provider: PaymentProvider.SBERBANK };
      const result = await service.createPayment(dto, 'user1');

      expect(mockOrderService.validateOrderOwnership).toHaveBeenCalledWith(
        'order1',
        'user1',
      );
      expect(mockPaymentRepository.create).toHaveBeenCalledWith({
        orderId: 'order1',
        provider: PaymentProvider.SBERBANK,
        amount: 100,
        currency: 'RUB',
        status: PaymentStatus.PENDING,
      });
      expect(result).toEqual(payment);
    });

    it('should throw ConflictException if order is not pending', async () => {
      const order = { id: 'order1', status: OrderStatus.PAID } as Order;
      mockOrderService.validateOrderOwnership.mockResolvedValue(order);
      const dto = { orderId: 'order1', provider: PaymentProvider.SBERBANK };

      await expect(service.createPayment(dto, 'user1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should return existing pending payment if one exists', async () => {
      const order = {
        id: 'order1',
        status: OrderStatus.PENDING,
        amount: 100,
        currency: 'RUB',
      } as Order;
      const existingPayment = {
        id: 'payment1',
        orderId: 'order1',
        status: PaymentStatus.PENDING,
      } as Payment;

      mockOrderService.validateOrderOwnership.mockResolvedValue(order);
      mockPaymentRepository.findOne.mockResolvedValue(existingPayment);

      const dto = { orderId: 'order1', provider: PaymentProvider.SBERBANK };
      const result = await service.createPayment(dto, 'user1');

      expect(mockOrderService.validateOrderOwnership).toHaveBeenCalledWith(
        'order1',
        'user1',
      );
      expect(mockPaymentRepository.findOne).toHaveBeenCalledWith({
        where: { orderId: 'order1', status: PaymentStatus.PENDING },
      });
      expect(mockPaymentRepository.save).not.toHaveBeenCalled();
      expect(result).toEqual(existingPayment);
    });
  });

  describe('confirmPayment', () => {
    it('should persist payment, update order, and publish events', async () => {
      const payment = {
        id: 'payment1',
        orderId: 'order1',
        status: PaymentStatus.PENDING,
        provider: PaymentProvider.SBERBANK,
        amount: 100,
        currency: 'RUB',
      } as Payment;
      const confirmedPayment = {
        ...payment,
        status: PaymentStatus.COMPLETED,
        completedAt: new Date(),
      } as Payment;
      const order: Order = {
        id: 'order1',
        userId: 'user1',
        gameId: 'game1',
        amount: 100,
        currency: 'RUB',
        status: OrderStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      } as Order;

      mockPaymentRepository.findOne.mockResolvedValue(payment);
      mockPaymentRepository.save.mockResolvedValue(confirmedPayment);
      mockOrderService.getOrder.mockResolvedValue(order);

      const result = await service.confirmPayment('payment1');

      expect(mockPaymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentStatus.COMPLETED }),
      );
      expect(mockOrderService.updateOrderStatus).toHaveBeenCalledWith(
        'order1',
        OrderStatus.PAID,
      );
      expect(mockLibraryService.addGameToLibrary).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user1',
          gameId: 'game1',
          orderId: 'order1',
        }),
      );
      expect(
        mockPaymentEventsService.publishPaymentCompleted,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ paymentId: 'payment1' }),
      );
      expect(result).toBe(confirmedPayment);
    });
  });
});
