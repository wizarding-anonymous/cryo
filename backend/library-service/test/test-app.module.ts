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
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RoleGuard } from '../src/auth/guards/role.guard';
import { InternalAuthGuard } from '../src/auth/guards/internal-auth.guard';

@Module({
  imports: [
    PrometheusModule.register(),
    AuthModule,
    ConfigModule,
    ClientsModule,
    AppCacheModule,
    EventsModule,
    // Test database configuration - uses PostgreSQL like production
    // Read DB options from env set in test-setup.ts or defaults for docker-compose.test.yml
    (() => {
      const dbOptions = {
        type: 'postgres' as const,
        host: process.env.DATABASE_HOST || '127.0.0.1',
        port: parseInt(process.env.DATABASE_PORT || '5433', 10),
        username: process.env.DATABASE_USERNAME || 'postgres',
        password: process.env.DATABASE_PASSWORD || 'test_password',
        database: process.env.DATABASE_NAME || 'library_service_test',
        entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
        synchronize: true,
        logging: false,
        dropSchema: true,
      };
      // Minimal debug to ensure correct values are used during e2e
      // eslint-disable-next-line no-console
      console.log('[e2e] TypeORM options', {
        host: dbOptions.host,
        port: dbOptions.port,
        username: dbOptions.username,
        password: dbOptions.password,
        database: dbOptions.database,
      });
      return TypeOrmModule.forRoot(dbOptions);
    })(),
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
  providers: [
    AppService,
    // Disable auth/role guards for e2e to allow internal endpoints
    // Keep JwtAuthGuard active to populate request.user from test JWTs
    { provide: RoleGuard, useValue: { canActivate: () => true } },
    { provide: InternalAuthGuard, useValue: { canActivate: () => true } },
  ],
})
export class TestAppModule {}
