import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { RedisConfig } from '../config/redis.config';
import { RedisService } from './redis.service';
import { REDIS_CLIENT } from './redis.constants';


@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {
  static forRootAsync(): DynamicModule {
    return {
      module: RedisModule,
      global: true,
      imports: [ConfigModule],
      providers: [
        {
          provide: REDIS_CLIENT,
          useFactory: (configService: ConfigService) => {
            const cfg = configService.get<RedisConfig>('redis');
            const client = new Redis({
              host: cfg!.host,
              port: cfg!.port,
              password: cfg!.password,
              db: cfg!.db,
              keyPrefix: cfg!.keyPrefix,
              lazyConnect: true,
              maxRetriesPerRequest: null,
            });
            return client;
          },
          inject: [ConfigService],
        },
      ],
      exports: [REDIS_CLIENT],
    };
  }
}
