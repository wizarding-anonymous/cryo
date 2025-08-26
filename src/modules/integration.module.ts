import { Module } from '@nestjs/common';
import { MockExternalIntegrationService } from '../application/services/mock-external-integration.service';

@Module({
  providers: [MockExternalIntegrationService],
  exports: [MockExternalIntegrationService],
})
export class IntegrationModule {}
