import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HttpModule } from '@nestjs/axios';
import { AppConfigModule } from '../config/config.module';

@Module({
  imports: [
    TerminusModule,
    // HttpModule is often used for HttpHealthIndicator if you need to ping external services
    HttpModule,
    // Import AppConfigModule to provide StartupValidationService and AppConfigService
    AppConfigModule,
  ],
  controllers: [HealthController],
})
export class HealthModule {}
