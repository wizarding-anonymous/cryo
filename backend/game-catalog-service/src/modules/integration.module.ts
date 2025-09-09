import { Module } from '@nestjs/common';
import { SteamApiService } from '../infrastructure/integrations/steam-api.service';
import { LibraryServiceIntegration } from '../infrastructure/integrations/library.service';
import { UserPreferenceServiceIntegration } from '../infrastructure/integrations/user-preference.service';
import { GreenlightIntegrationController } from '../infrastructure/http/controllers/greenlight.integration.controller';
import { GameModule } from './game.module'; // Import GameModule to access GameService

@Module({
  imports: [GameModule], // Make GameService available to this module's controllers
  controllers: [GreenlightIntegrationController],
  providers: [SteamApiService, LibraryServiceIntegration, UserPreferenceServiceIntegration],
  exports: [SteamApiService, LibraryServiceIntegration, UserPreferenceServiceIntegration],
})
export class IntegrationModule {}
