import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { OrderService } from '../order/order.service';
import { PaymentProviderService } from './payment-provider.service';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { OrderStatus } from '../../common/enums/order-status.enum';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly orderService: OrderService,
    private readonly paymentProviderService: PaymentProviderService,
  ) {}

  async createPayment(createPaymentDto: CreatePaymentDto, userId: string): Promise<Payment> {
    const { orderId, provider } = createPaymentDto;
    const order = await this.orderService.getOrder(orderId, userId);

    if (order.status !== OrderStatus.PENDING) {
      throw new NotFoundException(`Order #${orderId} is not pending and cannot be paid.`);
    }

    const newPayment = this.paymentRepository.create({
      orderId,
      provider,
      amount: order.amount,
      currency: order.currency,
      status: PaymentStatus.PENDING,
    });

    return this.paymentRepository.save(newPayment);
  }

  async processPayment(id: string): Promise<any> {
    const payment = await this.getPayment(id);
    const { paymentUrl, externalId } = await this.paymentProviderService.processPayment(payment);
    await this.paymentRepository.update(id, { externalId });
    return { paymentUrl };
  }

  async confirmPayment(id: string): Promise<void> {
    const payment = await this.getPayment(id);
    await this.paymentRepository.update(id, { status: PaymentStatus.COMPLETED, completedAt: new Date() });
    await this.orderService.updateOrderStatus(payment.orderId, OrderStatus.PAID);
  }

  async cancelPayment(id: string): Promise<void> {
    const payment = await this.getPayment(id);
    await this.paymentRepository.update(id, { status: PaymentStatus.CANCELLED });
    await this.orderService.updateOrderStatus(payment.orderId, OrderStatus.CANCELLED);
  }

  async getPayment(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({ where: { id } });
    if (!payment) {
      throw new NotFoundException(`Payment with ID #${id} not found.`);
    }
    return payment;
  }
}