import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheService } from './cache.service';
import { CacheController } from './cache.controller';
import { cacheConfig } from './cache.config';

@Module({
  imports: [CacheModule.registerAsync(cacheConfig)],
  controllers: [CacheController],
  providers: [CacheService],
  exports: [CacheService, CacheModule],
})
export class AppCacheModule {} // Renamed to avoid conflict with CacheModule from @nestjs/cache-manager
