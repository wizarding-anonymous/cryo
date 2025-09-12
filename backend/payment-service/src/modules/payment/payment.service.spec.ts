import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { OrderService } from '../order/order.service';
import { PaymentProviderService } from './payment-provider.service';
import { NotFoundException } from '@nestjs/common';
import { Order } from '../order/entities/order.entity';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { PaymentProvider } from '../../common/enums/payment-provider.enum';

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
  };

  const mockPaymentProviderService = {
    processPayment: jest.fn(),
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
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    repository = module.get<Repository<Payment>>(getRepositoryToken(Payment));
    orderService = module.get<OrderService>(OrderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPayment', () => {
    it('should create a payment if order is pending', async () => {
      const order = { id: 'order1', status: OrderStatus.PENDING, amount: 100, currency: 'RUB' } as Order;
      mockOrderService.getOrder.mockResolvedValue(order);
      const payment = new Payment();
      mockPaymentRepository.create.mockReturnValue(payment);
      mockPaymentRepository.save.mockResolvedValue(payment);

      const dto = { orderId: 'order1', provider: PaymentProvider.SBERBANK };
      const result = await service.createPayment(dto, 'user1');

      expect(mockOrderService.getOrder).toHaveBeenCalledWith('order1', 'user1');
      expect(mockPaymentRepository.create).toHaveBeenCalledWith({
        orderId: 'order1',
        provider: PaymentProvider.SBERBANK,
        amount: 100,
        currency: 'RUB',
        status: PaymentStatus.PENDING,
      });
      expect(result).toEqual(payment);
    });

    it('should throw NotFoundException if order is not pending', async () => {
      const order = { id: 'order1', status: OrderStatus.PAID } as Order;
      mockOrderService.getOrder.mockResolvedValue(order);
      const dto = { orderId: 'order1', provider: PaymentProvider.SBERBANK };

      await expect(service.createPayment(dto, 'user1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('confirmPayment', () => {
    it('should update payment and order status', async () => {
        const payment = { id: 'payment1', orderId: 'order1' } as Payment;
        mockPaymentRepository.findOne.mockResolvedValue(payment);

        await service.confirmPayment('payment1');

        expect(mockPaymentRepository.update).toHaveBeenCalledWith('payment1', expect.objectContaining({ status: PaymentStatus.COMPLETED }));
        expect(mockOrderService.updateOrderStatus).toHaveBeenCalledWith('order1', OrderStatus.PAID);
    });
  });
});
