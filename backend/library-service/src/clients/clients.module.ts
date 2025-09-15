import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GameCatalogClient } from './game-catalog.client';
import { UserServiceClient } from './user.client';
import { PaymentServiceClient } from './payment-service.client';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        timeout: configService.get('services.timeout', 5000),
        maxRedirects: 5,
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [GameCatalogClient, UserServiceClient, PaymentServiceClient],
  exports: [GameCatalogClient, UserServiceClient, PaymentServiceClient],
})
export class ClientsModule {}
