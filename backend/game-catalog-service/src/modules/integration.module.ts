import { Module } from '@nestjs/common';
import { SteamApiService } from '../infrastructure/integrations/steam-api.service';
import { LibraryServiceIntegration } from '../infrastructure/integrations/library.service';
import { UserPreferenceServiceIntegration } from '../infrastructure/integrations/user-preference.service';

@Module({
  providers: [SteamApiService, LibraryServiceIntegration, UserPreferenceServiceIntegration],
  exports: [SteamApiService, LibraryServiceIntegration, UserPreferenceServiceIntegration],
})
export class IntegrationModule {}
