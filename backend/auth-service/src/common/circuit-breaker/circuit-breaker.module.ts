import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CircuitBreakerConfig } from './circuit-breaker.config';
import { CircuitBreakerService } from './circuit-breaker.service';

@Module({
  imports: [ConfigModule],
  providers: [
    CircuitBreakerConfig,
    CircuitBreakerService,
  ],
  exports: [
    CircuitBreakerConfig,
    CircuitBreakerService,
  ],
})
export class CircuitBreakerModule {}