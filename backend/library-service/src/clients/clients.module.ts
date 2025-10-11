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
        timeout: 5000,
        maxRedirects: 5,
        retries: 0, // We handle retries in our clients
        headers: {
          'User-Agent': 'Library-Service/1.0',
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        // Connection pooling for better performance
        maxSockets: 100,
        maxFreeSockets: 10,
        // Keep-alive settings
        keepAlive: true,
        keepAliveMsecs: 30000,
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [GameCatalogClient, UserServiceClient, PaymentServiceClient],
  exports: [GameCatalogClient, UserServiceClient, PaymentServiceClient],
})
export class ClientsModule { }
