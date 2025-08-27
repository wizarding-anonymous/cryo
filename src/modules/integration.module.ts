import { Module } from '@nestjs/common';
import { MockExternalIntegrationService } from '../application/services/mock-external-integration.service';
import { CircuitBreakerModule } from './circuit-breaker.module';

@Module({
  imports: [CircuitBreakerModule],
  providers: [MockExternalIntegrationService],
  exports: [MockExternalIntegrationService],
})
export class IntegrationModule {}
