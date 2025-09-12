import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { GameCatalogIntegrationModule } from '../../integrations/game-catalog/game-catalog.module';
import { LibraryIntegrationModule } from '../../integrations/library/library.module';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
    GameCatalogIntegrationModule,
    LibraryIntegrationModule,
  ],
  controllers: [HealthController],
})
export class HealthModule {}