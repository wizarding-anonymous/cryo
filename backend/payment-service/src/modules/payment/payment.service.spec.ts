import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { OrderService } from '../order/order.service';
import { PaymentProviderService } from './payment-provider.service';
import { LibraryIntegrationService } from '../../integrations/library/library.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { PaymentEventsService } from './payment-events.service';
import { PaymentNotFoundException } from '../../common/exceptions/payment-not-found.exception';
import { PaymentAlreadyProcessedException } from '../../common/exceptions/payment-already-processed.exception';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { PaymentProvider } from '../../common/enums/payment-provider.enum';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { CreatePaymentDto } from './dto/create-payment.dto';

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepository: jest.Mocked<Repository<Payment>>;
  let orderService: jest.Mocked<OrderService>;
  let paymentProviderService: jest.Mocked<PaymentProviderService>;
  let libraryIntegrationService: jest.Mocked<LibraryIntegrationService>;
  let metricsService: jest.Mocked<MetricsService>;
  let paymentEventsService: jest.Mocked<PaymentEventsService>;

  const mockOrder = {
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

  const mockPayment: Payment = {
    id: 'payment-123',
    orderId: 'order-123',
    order: null,
    provider: PaymentProvider.SBERBANK,
    amount: 1999,
    currency: 'RUB',
    status: PaymentStatus.PENDING,
    externalId: null,
    providerResponse: null,
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    const mockOrderService = {
      validateOrderOwnership: jest.fn(),
      updateOrderStatus: jest.fn(),
      getOrder: jest.fn(),
    };

    const mockPaymentProviderService = {
      processPayment: jest.fn(),
    };

    const mockLibraryIntegrationService = {
      addGameToLibrary: jest.fn(),
    };

    const mockMetricsService = {
      recordPayment: jest.fn(),
      recordPaymentDuration: jest.fn(),
    };

    const mockPaymentEventsService = {
      publishPaymentCompleted: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: getRepositoryToken(Payment),
          useValue: mockRepository,
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
          useValue: mockLibraryIntegrationService,
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
    paymentRepository = module.get(getRepositoryToken(Payment));
    orderService = module.get(OrderService);
    paymentProviderService = module.get(PaymentProviderService);
    libraryIntegrationService = module.get(LibraryIntegrationService);
    metricsService = module.get(MetricsService);
    paymentEventsService = module.get(PaymentEventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPayment', () => {
    const createPaymentDto: CreatePaymentDto = {
      orderId: 'order-123',
      provider: PaymentProvider.SBERBANK,
    };

    it('should create a new payment successfully', async () => {
      orderService.validateOrderOwnership.mockResolvedValue(mockOrder);
      paymentRepository.findOne.mockResolvedValue(null);
      paymentRepository.create.mockReturnValue(mockPayment);
      paymentRepository.save.mockResolvedValue(mockPayment);

      const result = await service.createPayment(createPaymentDto, 'user-123');

      expect(orderService.validateOrderOwnership).toHaveBeenCalledWith(
        'order-123',
        'user-123',
      );
      expect(paymentRepository.create).toHaveBeenCalledWith({
        orderId: 'order-123',
        provider: PaymentProvider.SBERBANK,
        amount: 1999,
        currency: 'RUB',
        status: PaymentStatus.PENDING,
      });
      expect(result).toEqual(mockPayment);
    });

    it('should return existing pending payment if exists', async () => {
      const existingPayment = { ...mockPayment, status: PaymentStatus.PENDING };
      orderService.validateOrderOwnership.mockResolvedValue(mockOrder);
      paymentRepository.findOne.mockResolvedValue(existingPayment);

      const result = await service.createPayment(createPaymentDto, 'user-123');

      expect(paymentRepository.create).not.toHaveBeenCalled();
      expect(result).toEqual(existingPayment);
    });

    it('should throw ConflictException when order is not pending', async () => {
      const paidOrder = { ...mockOrder, status: OrderStatus.PAID };
      orderService.validateOrderOwnership.mockResolvedValue(paidOrder);

      await expect(
        service.createPayment(createPaymentDto, 'user-123'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('processPayment', () => {
    it('should process payment successfully', async () => {
      const processingPayment = {
        ...mockPayment,
        status: PaymentStatus.PENDING,
      };
      paymentRepository.findOne.mockResolvedValue(processingPayment);
      paymentProviderService.processPayment.mockResolvedValue({
        paymentUrl: 'https://mock-payment-url.com',
        externalId: 'ext-123',
      });
      paymentRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.processPayment('payment-123');

      expect(paymentRepository.update).toHaveBeenCalledWith('payment-123', {
        externalId: 'ext-123',
        status: PaymentStatus.PROCESSING,
      });
      expect(metricsService.recordPayment).toHaveBeenCalledWith(
        PaymentStatus.PROCESSING,
        PaymentProvider.SBERBANK,
      );
      expect(result).toEqual({ paymentUrl: 'https://mock-payment-url.com' });
    });

    it('should throw PaymentAlreadyProcessedException when payment is not pending', async () => {
      const completedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      };
      paymentRepository.findOne.mockResolvedValue(completedPayment);

      await expect(service.processPayment('payment-123')).rejects.toThrow(
        PaymentAlreadyProcessedException,
      );
    });
  });

  describe('confirmPayment', () => {
    it('should confirm payment successfully', async () => {
      const processingPayment = {
        ...mockPayment,
        status: PaymentStatus.PROCESSING,
      };
      const completedPayment = {
        ...processingPayment,
        status: PaymentStatus.COMPLETED,
        completedAt: new Date(),
      };

      paymentRepository.findOne.mockResolvedValue(processingPayment);
      paymentRepository.save.mockResolvedValue(completedPayment);
      orderService.getOrder.mockResolvedValue(mockOrder);
      libraryIntegrationService.addGameToLibrary.mockResolvedValue(undefined);
      paymentEventsService.publishPaymentCompleted.mockResolvedValue(undefined);

      const result = await service.confirmPayment('payment-123');

      expect(paymentRepository.save).toHaveBeenCalledWith({
        ...processingPayment,
        status: PaymentStatus.COMPLETED,
        completedAt: expect.any(Date),
      });
      expect(orderService.updateOrderStatus).toHaveBeenCalledWith(
        'order-123',
        OrderStatus.PAID,
      );
      expect(libraryIntegrationService.addGameToLibrary).toHaveBeenCalledWith({
        userId: 'user-123',
        gameId: 'game-123',
        orderId: 'order-123',
        purchasePrice: 1999,
        currency: 'RUB',
      });
      expect(result.status).toEqual(PaymentStatus.COMPLETED);
    });

    it('should return payment if already completed', async () => {
      const completedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      };
      paymentRepository.findOne.mockResolvedValue(completedPayment);

      const result = await service.confirmPayment('payment-123');

      expect(paymentRepository.save).not.toHaveBeenCalled();
      expect(result).toEqual(completedPayment);
    });
  });

  describe('cancelPayment', () => {
    it('should cancel payment successfully', async () => {
      const pendingPayment = { ...mockPayment, status: PaymentStatus.PENDING };
      const cancelledPayment = {
        ...pendingPayment,
        status: PaymentStatus.CANCELLED,
      };

      paymentRepository.findOne.mockResolvedValue(pendingPayment);
      paymentRepository.save.mockResolvedValue(cancelledPayment);

      const result = await service.cancelPayment('payment-123');

      expect(paymentRepository.save).toHaveBeenCalledWith({
        ...pendingPayment,
        status: PaymentStatus.CANCELLED,
      });
      expect(orderService.updateOrderStatus).toHaveBeenCalledWith(
        'order-123',
        OrderStatus.CANCELLED,
      );
      expect(result.status).toEqual(PaymentStatus.CANCELLED);
    });

    it('should return payment if already cancelled', async () => {
      const cancelledPayment = {
        ...mockPayment,
        status: PaymentStatus.CANCELLED,
      };
      paymentRepository.findOne.mockResolvedValue(cancelledPayment);

      const result = await service.cancelPayment('payment-123');

      expect(paymentRepository.save).not.toHaveBeenCalled();
      expect(result).toEqual(cancelledPayment);
    });
  });

  describe('getPayment', () => {
    it('should return payment when found', async () => {
      paymentRepository.findOne.mockResolvedValue(mockPayment);

      const result = await service.getPayment('payment-123');

      expect(paymentRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'payment-123' },
      });
      expect(result).toEqual(mockPayment);
    });

    it('should throw PaymentNotFoundException when payment not found', async () => {
      paymentRepository.findOne.mockResolvedValue(null);

      await expect(service.getPayment('payment-123')).rejects.toThrow(
        PaymentNotFoundException,
      );
    });
  });

  describe('findByExternalId', () => {
    it('should return payment when found by external ID', async () => {
      paymentRepository.findOne.mockResolvedValue(mockPayment);

      const result = await service.findByExternalId('ext-123');

      expect(paymentRepository.findOne).toHaveBeenCalledWith({
        where: { externalId: 'ext-123' },
      });
      expect(result).toEqual(mockPayment);
    });

    it('should return null when payment not found by external ID', async () => {
      paymentRepository.findOne.mockResolvedValue(null);

      const result = await service.findByExternalId('ext-123');

      expect(result).toBeNull();
    });
  });
});
