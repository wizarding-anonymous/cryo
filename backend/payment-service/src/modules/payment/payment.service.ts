import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { OrderNotFoundException } from '../../common/exceptions/order-not-found.exception';
import { PaymentNotFoundException } from '../../common/exceptions/payment-not-found.exception';
import { PaymentAlreadyProcessedException } from '../../common/exceptions/payment-already-processed.exception';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { OrderService } from '../order/order.service';
import { PaymentProviderService } from './payment-provider.service';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { LibraryIntegrationService } from '../../integrations/library/library.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { Order } from '../order/entities/order.entity';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly orderService: OrderService,
    private readonly paymentProviderService: PaymentProviderService,
    private readonly libraryIntegrationService: LibraryIntegrationService,
    private readonly metricsService: MetricsService,
  ) {}

  async createPayment(createPaymentDto: CreatePaymentDto, userId: string): Promise<Payment> {
    const { orderId, provider } = createPaymentDto;
    const order = await this.orderService.getOrder(orderId, userId);

    if (order.status !== OrderStatus.PENDING) {
      throw new ConflictException(`Order #${orderId} is not pending and cannot be paid.`);
    }

    const existingPayment = await this.paymentRepository.findOne({
      where: { orderId, status: PaymentStatus.PENDING },
    });

    if (existingPayment) {
      return existingPayment;
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
    const startTime = Date.now();
    const payment = await this.getPayment(id);
    if (payment.status !== PaymentStatus.PENDING) {
      throw new PaymentAlreadyProcessedException(id);
    }

    const { paymentUrl, externalId } = await this.paymentProviderService.processPayment(payment);

    await this.paymentRepository.update(id, { externalId, status: PaymentStatus.PROCESSING });
    this.metricsService.recordPayment(PaymentStatus.PROCESSING, payment.provider);

    const duration = (Date.now() - startTime) / 1000;
    this.metricsService.recordPaymentDuration(payment.provider, duration);

    return { paymentUrl };
  }

  async confirmPayment(id: string): Promise<void> {
    const payment = await this.getPayment(id);
     if (payment.status === PaymentStatus.COMPLETED) {
      this.logger.warn(`Payment ${id} has already been completed. Skipping.`);
      return;
    }

    await this.paymentRepository.update(id, { status: PaymentStatus.COMPLETED, completedAt: new Date() });
    await this.orderService.updateOrderStatus(payment.orderId, OrderStatus.PAID);
    this.metricsService.recordPayment(PaymentStatus.COMPLETED, payment.provider);

    const order = await this.orderService.getOrder(payment.orderId);
    if (order) {
      await this.libraryIntegrationService.addGameToLibrary({
        userId: order.userId,
        gameId: order.gameId,
        orderId: order.id,
        purchasePrice: order.amount,
        currency: order.currency,
      });
    } else {
        this.logger.error(`Could not find order ${payment.orderId} after payment confirmation. Cannot add to library.`);
    }
  }

  async cancelPayment(id: string): Promise<void> {
    const payment = await this.getPayment(id);
    if (payment.status === PaymentStatus.CANCELLED) {
      return;
    }
    await this.paymentRepository.update(id, { status: PaymentStatus.CANCELLED });
    await this.orderService.updateOrderStatus(payment.orderId, OrderStatus.CANCELLED);
    this.metricsService.recordPayment(PaymentStatus.CANCELLED, payment.provider);
  }

  async getPayment(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({ where: { id } });
    if (!payment) {
      throw new PaymentNotFoundException(id);
    }
    return payment;
  }

  async findByExternalId(externalId: string): Promise<Payment | null> {
    return this.paymentRepository.findOne({ where: { externalId } });
  }
}