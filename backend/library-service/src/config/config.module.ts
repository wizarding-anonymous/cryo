import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validate } from './env.validation';

@Module({
  imports: [
    NestConfigModule.forRoot({
      validate,
      isGlobal: true,
      cache: true,
      // Don't load configuration.ts - use direct env variables like user-service
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
