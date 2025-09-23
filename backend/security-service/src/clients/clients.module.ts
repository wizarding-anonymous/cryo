import { Global, Module } from '@nestjs/common';
import { UserServiceClient } from './user-service.client';
import { NotificationServiceClient } from './notification-service.client';

@Global()
@Module({
  providers: [UserServiceClient, NotificationServiceClient],
  exports: [UserServiceClient, NotificationServiceClient],
})
export class ClientsModule {}

