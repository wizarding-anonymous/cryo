import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { GameCatalogIntegrationService } from './game-catalog.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [GameCatalogIntegrationService],
  exports: [GameCatalogIntegrationService],
})
export class GameCatalogIntegrationModule {}
