import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { AppConfigModule } from '../../config/config.module';

@Module({
  imports: [AppConfigModule],
  providers: [
    RedisService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: (redisService: RedisService) => {
        return redisService.getClient();
      },
      inject: [RedisService],
    },
  ],
  exports: [RedisService, 'REDIS_CLIENT'],
})
export class RedisModule {}
