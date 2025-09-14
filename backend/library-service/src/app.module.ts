import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import {
  ConfigModule as NestConfigModule,
  ConfigService,
} from '@nestjs/config';
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
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register(),
    AuthModule,
    ConfigModule,
    ClientsModule,
    AppCacheModule,
    EventsModule,
    TypeOrmModule.forRootAsync({
      imports: [NestConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('database.synchronize'),
        logging: configService.get('database.logging'),
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: process.env.NODE_ENV === 'production', // Auto-run migrations in production
        migrationsTableName: 'migrations',
        // Connection pooling for better performance
        extra: {
          max: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20', 10),
          min: parseInt(process.env.DATABASE_MIN_CONNECTIONS || '5', 10),
          acquireTimeoutMillis: parseInt(process.env.DATABASE_ACQUIRE_TIMEOUT || '60000', 10),
          idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '600000', 10),
        },
      }),
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      imports: [NestConfigModule],
      useFactory: (configService: ConfigService) => ({
        ttl: configService.get('redis.ttl'),
        max: 100, // Maximum number of items in cache
        // For now, use in-memory cache. Redis can be added later when needed
        // This ensures the service works without Redis dependency for MVP
      }),
      inject: [ConfigService],
      isGlobal: true,
    }),
    LibraryModule,
    HistoryModule,
    HealthModule,
  ],
  controllers: [AppController, MetricsController],
  providers: [AppService],
})
export class AppModule {}
