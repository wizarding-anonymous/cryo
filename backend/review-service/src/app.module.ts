import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE, APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { databaseConfig } from './config/database.config';
import { redisConfig } from './config/redis.config';
import { Review, GameRating } from './entities';
import { ReviewService, RatingService, OwnershipService, MetricsService, BackgroundTasksService } from './services';
import { ReviewController, RatingController, AdminController } from './controllers';
import { HttpExceptionFilter } from './filters';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRoot(databaseConfig()),
    TypeOrmModule.forFeature([Review, GameRating]),
    CacheModule.register(redisConfig()),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 3,
    }),
  ],
  controllers: [AppController, ReviewController, RatingController, AdminController],
  providers: [
    AppService,
    ReviewService,
    RatingService,
    OwnershipService,
    MetricsService,
    BackgroundTasksService,
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
