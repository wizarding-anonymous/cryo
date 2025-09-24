import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        if (redisUrl) {
          return new Redis(redisUrl, { connectTimeout: 5000, lazyConnect: false });
        }

        const host = config.get<string>('REDIS_HOST', 'localhost');
        const port = config.get<number>('REDIS_PORT', 6379);
        const password = config.get<string | undefined>('REDIS_PASSWORD');
        return new Redis({ host, port, password, connectTimeout: 5000, lazyConnect: false });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule { }
