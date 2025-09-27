import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '../../redis/redis.module';
import {
  LoggingInterceptor,
  ResponseInterceptor,
  CacheInterceptor,
  CorsInterceptor,
} from './index';

@Module({
  imports: [ConfigModule, RedisModule],
  providers: [
    LoggingInterceptor,
    ResponseInterceptor,
    CacheInterceptor,
    CorsInterceptor,
  ],
  exports: [
    LoggingInterceptor,
    ResponseInterceptor,
    CacheInterceptor,
    CorsInterceptor,
  ],
})
export class InterceptorsModule {}
