import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LibraryIntegrationModule } from '../../integrations/library/library.module';
import { MetricsModule } from '../../common/metrics/metrics.module';
import { PaymentController } from './payment.controller';
import { MockPaymentController } from './mock-payment.controller';
import { MockFormsController } from './mock-forms.controller';
import { WebhookController } from './webhook.controller';
import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { OrderModule } from '../order/order.module';
import { PaymentProviderService } from './payment-provider.service';
import { PaymentProviderFactory } from './payment-provider.factory';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    OrderModule,
    LibraryIntegrationModule,
    MetricsModule,
  ],
  controllers: [PaymentController, MockPaymentController, MockFormsController, WebhookController],
  providers: [PaymentService, PaymentProviderService, PaymentProviderFactory],
  exports: [PaymentService],
})
export class PaymentModule {}
