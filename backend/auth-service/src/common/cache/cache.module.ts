import { Module } from '@nestjs/common';
import { UserCacheService } from './user-cache.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [UserCacheService],
  exports: [UserCacheService],
})
export class CacheModule {}