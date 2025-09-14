import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { MetricsController } from '../src/metrics.controller';
import { LibraryModule } from '../src/library/library.module';
import { HistoryModule } from '../src/history/history.module';
import { HealthModule } from '../src/health/health.module';
import { ConfigModule } from '../src/config/config.module';
import { AuthModule } from '../src/auth/auth.module';
import { ClientsModule } from '../src/clients/clients.module';
import { AppCacheModule } from '../src/cache/cache.module';
import { EventsModule } from '../src/events/events.module';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register(),
    AuthModule,
    ConfigModule,
    ClientsModule,
    AppCacheModule,
    EventsModule,
    // Test database configuration - uses PostgreSQL like production
    TypeOrmModule.forRootAsync({
      imports: [NestConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host', 'localhost'),
        port: configService.get('database.port', 5432),
        username: configService.get('database.username', 'postgres'),
        password: configService.get('database.password', 'password'),
        database: configService.get('database.database', 'library_service_test'),
        entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
        synchronize: true, // OK for tests - creates schema automatically
        logging: false, // Disable logging in tests
        dropSchema: true, // Clean slate for each test
      }),
      inject: [ConfigService],
    }),
    // Test cache configuration - simple memory cache
    CacheModule.registerAsync({
      imports: [NestConfigModule],
      useFactory: () => ({
        store: 'memory', // Use memory store for tests instead of Redis
        ttl: 60, // Short TTL for tests
        max: 100, // Limit cache size in tests
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
export class TestAppModule {}
