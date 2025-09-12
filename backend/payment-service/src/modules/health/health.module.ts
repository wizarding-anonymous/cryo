import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
    PrometheusModule.register({
      controller: HealthController,
    }),
  ],
  controllers: [HealthController],
})
export class HealthModule {}