import { Module } from '@nestjs/common';
import { NotificationModule } from './notification/notification.module';
import { SecurityModule } from './security/security.module';
import { AuthServiceModule } from './auth/auth-service.module';
import { CircuitBreakerModule } from './circuit-breaker/circuit-breaker.module';
import { EventPublisherModule } from './events/event-publisher.module';
import { IntegrationService } from './integration.service';
import { IntegrationsController } from './integrations.controller';

@Module({
  imports: [
    NotificationModule,
    SecurityModule,
    AuthServiceModule,
    CircuitBreakerModule,
    EventPublisherModule,
  ],
  controllers: [IntegrationsController],
  providers: [IntegrationService],
  exports: [
    NotificationModule,
    SecurityModule,
    AuthServiceModule,
    CircuitBreakerModule,
    EventPublisherModule,
    IntegrationService,
  ],
})
export class IntegrationsModule {}
