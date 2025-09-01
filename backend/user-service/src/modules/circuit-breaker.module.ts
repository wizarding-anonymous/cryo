import { Module } from '@nestjs/common';
import { CircuitBreakerService } from '../application/services/circuit-breaker.service';

@Module({
  providers: [CircuitBreakerService],
  exports: [CircuitBreakerService],
})
export class CircuitBreakerModule {}
