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
import { ReviewService, RatingService, OwnershipService, MetricsService, BackgroundTasksService, AchievementService, NotificationService, GameCatalogService } from './services';
import { ReviewController, RatingController, AdminController, ExternalController } from './controllers';
import { HttpExceptionFilter } from './filters';
import { HealthModule } from './health/health.module';
import { MonitoringModule } from './monitoring/monitoring.module';

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
    HealthModule,
    MonitoringModule,
  ],
  controllers: [AppController, ReviewController, RatingController, AdminController, ExternalController],
  providers: [
    AppService,
    ReviewService,
    RatingService,
    OwnershipService,
    MetricsService,
    BackgroundTasksService,
    AchievementService,
    NotificationService,
    GameCatalogService,
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
