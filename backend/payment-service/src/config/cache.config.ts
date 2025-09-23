import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheModuleOptions, CacheOptionsFactory } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';

@Injectable()
export class CacheConfig implements CacheOptionsFactory {
  constructor(private configService: ConfigService) {}

  createCacheOptions(): CacheModuleOptions {
    const redisHost = this.configService.get<string>('REDIS_HOST');
    const redisPort = this.configService.get<number>('REDIS_PORT');
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    console.log(`Redis config: ${redisHost}:${redisPort}`);

    return {
      store: redisStore as any,
      socket: {
        host: redisHost,
        port: redisPort,
      },
      password: redisPassword || undefined,
      ttl: 300, // 5 minutes default TTL
      max: 1000, // Maximum number of items in cache
    };
  }
}
