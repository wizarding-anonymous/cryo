import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    TerminusModule,
    // HttpModule is useful for HttpHealthIndicator if we need to ping external services
    HttpModule,
  ],
  controllers: [HealthController],
})
export class HealthModule {}
