import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';

@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class AppCacheModule {} // Renamed to avoid conflict with CacheModule from @nestjs/cache-manager
