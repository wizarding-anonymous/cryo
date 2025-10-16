import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
// import { APP_GUARD } from '@nestjs/core';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { IntegrationsModule } from '../src/integrations/integrations.module';
import { UserModule } from '../src/user/user.module';

import { ProfileModule } from '../src/profile/profile.module';
import { TestHealthModule } from './test-health.module';
import { AppPrometheusModule } from '../src/common/prometheus/prometheus.module';
import { TestConfigModule } from './test-config.module';

@Module({
  imports: [
    // --- Test Config Module (without startup validation) ---
    TestConfigModule,

    // --- Throttler Module with high limits for tests ---
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 1000, // Very high limit for tests
      },
    ]),

    // --- TypeORM Module (PostgreSQL for tests) ---
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('POSTGRES_HOST'),
        port: parseInt(configService.get<string>('POSTGRES_PORT'), 10),
        username: configService.get<string>('POSTGRES_USER'),
        password: configService.get<string>('POSTGRES_PASSWORD'),
        database: configService.get<string>('POSTGRES_DB'),
        autoLoadEntities: true,
        synchronize: false, // Use migrations instead of sync
        dropSchema: false, // Don't drop schema
      }),
    }),

    // --- Cache Module (In-Memory for tests) ---
    CacheModule.register({
      isGlobal: true,
    }),

    // --- Custom Modules ---
    IntegrationsModule,
    UserModule,
    ProfileModule,
    TestHealthModule,
    AppPrometheusModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // ThrottlerGuard is completely disabled in tests
  ],
})
export class TestAppModule {}
