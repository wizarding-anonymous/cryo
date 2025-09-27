import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { LibraryIntegrationService } from './library.service';
import { MetricsModule } from '../../common/metrics/metrics.module';

@Module({
  imports: [HttpModule, ConfigModule, MetricsModule],
  providers: [LibraryIntegrationService],
  exports: [LibraryIntegrationService],
})
export class LibraryIntegrationModule {}
