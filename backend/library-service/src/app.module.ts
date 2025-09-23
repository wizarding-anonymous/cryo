import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MetricsController } from './metrics.controller';
import { LibraryModule } from './library/library.module';
import { HistoryModule } from './history/history.module';
import { HealthModule } from './health/health.module';
import { ConfigModule } from './config/config.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { AppCacheModule } from './cache/cache.module';
import { EventsModule } from './events/events.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    PrometheusModule.register(),
    AuthModule,
    ConfigModule,
    ClientsModule,
    AppCacheModule,
    EventsModule,
    DatabaseModule,
    LibraryModule,
    HistoryModule,
    HealthModule,
  ],
  controllers: [AppController, MetricsController],
  providers: [AppService],
})
export class AppModule {}
