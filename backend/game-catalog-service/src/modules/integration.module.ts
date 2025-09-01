import { Module } from '@nestjs/common';
import { SteamApiService } from '../infrastructure/integrations/steam-api.service';

@Module({
  providers: [SteamApiService],
  exports: [SteamApiService],
})
export class IntegrationModule {}
