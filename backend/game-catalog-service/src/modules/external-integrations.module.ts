import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { PreorderServiceClient } from '../infrastructure/integrations/preorder-service.client';
import { GreenlightServiceClient } from '../infrastructure/integrations/greenlight-service.client';
import { GameKeysServiceClient } from '../infrastructure/integrations/game-keys-service.client';
import { CouponServiceClient } from '../infrastructure/integrations/coupon-service.client';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  providers: [
    PreorderServiceClient,
    GreenlightServiceClient,
    GameKeysServiceClient,
    CouponServiceClient,
  ],
  exports: [
    PreorderServiceClient,
    GreenlightServiceClient,
    GameKeysServiceClient,
    CouponServiceClient,
  ],
})
export class ExternalIntegrationsModule {}