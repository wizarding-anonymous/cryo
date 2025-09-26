import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServiceRegistryService } from './service-registry.service';

@Module({
  imports: [ConfigModule],
  providers: [ServiceRegistryService],
  exports: [ServiceRegistryService],
})
export class ServiceRegistryModule {}
