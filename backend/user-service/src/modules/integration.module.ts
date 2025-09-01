import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SocialServiceIntegrationService } from '../application/services/social-service-integration.service';
import { PaymentServiceIntegrationService } from '../application/services/payment-service-integration.service';
import { IntegrationMonitoringService } from '../application/services/integration-monitoring.service';
import { IntegrationMonitoringController } from '../infrastructure/http/controllers/integration-monitoring.controller';
import { ISocialServiceIntegration } from '../domain/interfaces/social-service.interface';
import { IPaymentServiceIntegration } from '../domain/interfaces/payment-service.interface';
import { CircuitBreakerModule } from './circuit-breaker.module';
import { MetricsService } from '../application/services/metrics.service';
import { EventsModule } from '../application/events/events.module';
import { RoleModule } from './role.module';

@Module({
  imports: [CircuitBreakerModule, ScheduleModule.forRoot(), EventsModule, RoleModule],
  controllers: [IntegrationMonitoringController],
  providers: [
    {
      provide: ISocialServiceIntegration,
      useClass: SocialServiceIntegrationService,
    },
    {
      provide: IPaymentServiceIntegration,
      useClass: PaymentServiceIntegrationService,
    },
    IntegrationMonitoringService,
    MetricsService,
  ],
  exports: [ISocialServiceIntegration, IPaymentServiceIntegration, IntegrationMonitoringService],
})
export class IntegrationModule {}
