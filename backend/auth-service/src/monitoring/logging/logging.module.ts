import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { CorrelationService } from './correlation.service';
import { StructuredLoggerService } from './structured-logger.service';
import { LoggingInterceptor } from './logging.interceptor';
import { createWinstonConfig } from './winston.config';

@Module({
  imports: [
    WinstonModule.forRootAsync({
      useFactory: () => createWinstonConfig(),
    }),
  ],
  providers: [
    CorrelationService,
    StructuredLoggerService,
    LoggingInterceptor,
  ],
  exports: [
    CorrelationService,
    StructuredLoggerService,
    LoggingInterceptor,
  ],
})
export class LoggingModule {}