import { Module } from '@nestjs/common';
import { PaymentSimulationController } from './payment-simulation.controller';
import { AdminGuard } from '../../common/auth/admin.guard';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [PaymentModule],
  controllers: [PaymentSimulationController],
  providers: [AdminGuard],
})
export class AdminModule {}
