import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Payment } from './entities/payment.entity';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { PaymentProvider } from '../../common/enums/payment-provider.enum';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PaymentCacheInterceptor } from '../../common/interceptors/payment-cache.interceptor';

describe('PaymentController', () => {
  let controller: PaymentController;
  let paymentService: PaymentService;

  const mockPaymentService = {
    createPayment: jest.fn(),
    processPayment: jest.fn(),
    getPayment: jest.fn(),
    confirmPayment: jest.fn(),
    cancelPayment: jest.fn(),
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
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: mockPaymentService,
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

    controller = module.get<PaymentController>(PaymentController);
    paymentService = module.get<PaymentService>(PaymentService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new payment', async () => {
      const createPaymentDto: CreatePaymentDto = {
        orderId: 'test-order-id',
        provider: PaymentProvider.SBERBANK,
      };

      const mockPayment: Partial<Payment> = {
        id: 'test-payment-id',
        orderId: createPaymentDto.orderId,
        provider: createPaymentDto.provider,
        status: PaymentStatus.PENDING,
        amount: 1999.99,
        currency: 'RUB',
      };

      const mockRequest = {
        user: { userId: 'test-user-id' },
      };

      mockPaymentService.createPayment.mockResolvedValue(mockPayment);

      const result = await controller.create(createPaymentDto, mockRequest);

      expect(paymentService.createPayment).toHaveBeenCalledWith(
        createPaymentDto,
        'test-user-id',
      );
      expect(result).toEqual(mockPayment);
    });
  });

  describe('process', () => {
    it('should process a payment', async () => {
      const paymentId = 'test-payment-id';
      const mockProcessResult = {
        paymentUrl: 'https://mock-payment-url.com',
        externalId: 'external-123',
      };

      mockPaymentService.processPayment.mockResolvedValue(mockProcessResult);

      const result = await controller.process(paymentId);

      expect(paymentService.processPayment).toHaveBeenCalledWith(paymentId);
      expect(result).toEqual(mockProcessResult);
    });
  });

  describe('findOne', () => {
    it('should return payment details', async () => {
      const paymentId = 'test-payment-id';
      const mockPayment: Partial<Payment> = {
        id: paymentId,
        orderId: 'test-order-id',
        provider: PaymentProvider.SBERBANK,
        status: PaymentStatus.PENDING,
        amount: 1999.99,
        currency: 'RUB',
      };

      mockPaymentService.getPayment.mockResolvedValue(mockPayment);

      const result = await controller.findOne(paymentId);

      expect(paymentService.getPayment).toHaveBeenCalledWith(paymentId);
      expect(result).toEqual(mockPayment);
    });
  });

  describe('confirm', () => {
    it('should confirm a payment', async () => {
      const paymentId = 'test-payment-id';
      const mockConfirmedPayment: Partial<Payment> = {
        id: paymentId,
        status: PaymentStatus.COMPLETED,
      };

      mockPaymentService.confirmPayment.mockResolvedValue(mockConfirmedPayment);

      const result = await controller.confirm(paymentId);

      expect(paymentService.confirmPayment).toHaveBeenCalledWith(paymentId);
      expect(result).toEqual(mockConfirmedPayment);
    });
  });

  describe('cancel', () => {
    it('should cancel a payment', async () => {
      const paymentId = 'test-payment-id';
      const mockCancelledPayment: Partial<Payment> = {
        id: paymentId,
        status: PaymentStatus.CANCELLED,
      };

      mockPaymentService.cancelPayment.mockResolvedValue(mockCancelledPayment);

      const result = await controller.cancel(paymentId);

      expect(paymentService.cancelPayment).toHaveBeenCalledWith(paymentId);
      expect(result).toEqual(mockCancelledPayment);
    });
  });
});
