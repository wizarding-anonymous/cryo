import { Module } from '@nestjs/common';
import { UserServiceClient } from './user-service.client';

@Module({
  providers: [UserServiceClient],
  exports: [UserServiceClient],
})
export class ClientsModule {}

