import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { HttpModule } from '@nestjs/axios';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ReviewsModule } from './reviews/reviews.module';

// Configuration imports
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import appConfig from './config/app.config';

@Module({
  imports: [
    // Configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig, appConfig],
      envFilePath: ['.env.local', '.env'],
    }),

    // Database module
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => configService.get('database')!,
      inject: [ConfigService],
    }),

    // Cache module (Redis)
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => configService.get('redis')!,
      inject: [ConfigService],
      isGlobal: true,
    }),

    // HTTP module for external service calls
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),

    // Feature Modules
    ReviewsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
