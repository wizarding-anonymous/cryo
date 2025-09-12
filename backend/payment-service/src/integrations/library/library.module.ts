import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { LibraryIntegrationService } from './library.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [LibraryIntegrationService],
  exports: [LibraryIntegrationService],
})
export class LibraryIntegrationModule {}
