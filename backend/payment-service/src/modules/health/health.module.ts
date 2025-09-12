import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { GameCatalogIntegrationModule } from '../../integrations/game-catalog/game-catalog.module';
import { LibraryIntegrationModule } from '../../integrations/library/library.module';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
    GameCatalogIntegrationModule,
    LibraryIntegrationModule,
    PrometheusModule.register({
      controller: HealthController,
    }),
  ],
  controllers: [HealthController],
})
export class HealthModule {}