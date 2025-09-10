import { Module } from '@nestjs/common';
import { NotificationModule } from './notification/notification.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [NotificationModule, SecurityModule],
  exports: [NotificationModule, SecurityModule],
})
export class IntegrationsModule {}
