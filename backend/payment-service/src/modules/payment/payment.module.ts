import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LibraryIntegrationModule } from '../../integrations/library/library.module';
import { PaymentController } from './payment.controller';
import { MockPaymentController } from './mock-payment.controller';
import { WebhookController } from './webhook.controller';
import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { OrderModule } from '../order/order.module';
import { PaymentProviderService } from './payment-provider.service';
import { PaymentProviderFactory } from './payment-provider.factory';
import { SberbankMockProvider } from './providers/sberbank.provider';
import { YandexMoneyMockProvider } from './providers/ymoney.provider';
import { TinkoffMockProvider } from './providers/tinkoff.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    OrderModule,
    LibraryIntegrationModule,
  ],
  controllers: [PaymentController, MockPaymentController, WebhookController],
  providers: [
    PaymentService,
    PaymentProviderService,
    PaymentProviderFactory,
    // The providers themselves are not directly injected anymore,
    // but the factory needs them to be available in the DI container
    // if they had dependencies. For now, they are simple classes.
    // We list them here so NestJS is aware of them.
    SberbankMockProvider,
    YandexMoneyMockProvider,
    TinkoffMockProvider,
  ],
  exports: [PaymentService],
})
export class PaymentModule {}