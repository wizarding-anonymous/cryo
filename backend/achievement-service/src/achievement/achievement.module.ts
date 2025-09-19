import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AchievementController } from './controllers/achievement.controller';
import { ProgressController } from './controllers/progress.controller';
import { IntegrationController } from './controllers/integration.controller';
import { AchievementService } from './services/achievement.service';
import { ProgressService } from './services/progress.service';
import { EventService } from './services/event.service';
import { NotificationService } from './services/notification.service';
import { LibraryService } from './services/library.service';
import { Achievement, UserAchievement, UserProgress } from './entities';
import { JwtAuthGuard } from './guards';
import { LoggingInterceptor, CacheInterceptor } from './interceptors';
import { AllExceptionsFilter } from './filters';
import { ValidationPipe } from './pipes';

@Module({
  imports: [
    TypeOrmModule.forFeature([Achievement, UserAchievement, UserProgress]),
    CacheModule.register({
      ttl: 300, // 5 minutes default TTL
      max: 1000, // maximum number of items in cache
    }),
    ConfigModule,
  ],
  controllers: [AchievementController, ProgressController, IntegrationController],
  providers: [
    AchievementService,
    ProgressService,
    EventService,
    NotificationService,
    LibraryService,
    // Global providers
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
  exports: [AchievementService, ProgressService, EventService, NotificationService, LibraryService],
})
export class AchievementModule {}
