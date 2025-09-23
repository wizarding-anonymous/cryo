import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import {
  ConfigModule as NestConfigModule,
  ConfigService,
} from '@nestjs/config';
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

export const createTypeOrmConfig = (configService: ConfigService) => ({
  type: 'postgres' as const,
  host: configService.get('database.host'),
  port: configService.get('database.port'),
  username: configService.get('database.username'),
  password: configService.get('database.password'),
  database: configService.get('database.database'),
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  synchronize: configService.get('database.synchronize'),
  logging: configService.get('database.logging'),
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsRun: process.env.NODE_ENV === 'production',
  migrationsTableName: 'migrations',
  extra: {
    max: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20', 10),
    min: parseInt(process.env.DATABASE_MIN_CONNECTIONS || '5', 10),
    acquireTimeoutMillis: parseInt(process.env.DATABASE_ACQUIRE_TIMEOUT || '60000', 10),
    idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '600000', 10),
  },
});

export const createCacheConfig = async (configService: ConfigService) => {
  const ttl = configService.get<number>('redis.ttl');
  const redisHost = configService.get<string>('redis.host');
  const redisPort = configService.get<number>('redis.port');
  const redisPassword = configService.get<string | undefined>('redis.password');

  try {
    // Dynamically import redis store. If not available, fallback to in-memory store.
    const { redisStore } = await import('cache-manager-redis-yet');
    const store = await redisStore({
      socket: { host: redisHost, port: redisPort },
      password: redisPassword,
      ttl,
    } as any);
    return {
      store,
      ttl,
      max: 100,
    } as any;
  } catch {
    // Fallback to in-memory cache in environments where Redis store is unavailable
    return {
      ttl,
      max: 100,
    } as any;
  }
};

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
      useFactory: createTypeOrmConfig,
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      imports: [NestConfigModule],
      useFactory: createCacheConfig,
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
