import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { PaymentProviderService } from './payment-provider.service';
import { OrderModule } from '../order/order.module';
import { SberbankPaymentProvider } from './providers/sberbank.provider';
import { YMoneyPaymentProvider } from './providers/ymoney.provider';
import { TBankPaymentProvider } from './providers/tbank.provider';

@Module({
  imports: [TypeOrmModule.forFeature([Payment]), OrderModule],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    PaymentProviderService,
    SberbankPaymentProvider,
    YMoneyPaymentProvider,
    TBankPaymentProvider,
  ],
  exports: [PaymentService],
})
export class PaymentModule {}