import { Global, Module } from '@nestjs/common';
import { PaymentLoggerService } from './payment-logger.service';
import { AlsModule } from '../als/als.module';

@Global()
@Module({
  imports: [AlsModule],
  providers: [PaymentLoggerService],
  exports: [PaymentLoggerService],
})
export class LoggingModule {}
