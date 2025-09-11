import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { IntegrationsModule } from '../src/integrations/integrations.module';
import { UserModule } from '../src/user/user.module';
import { AuthModule } from '../src/auth/auth.module';
import { ProfileModule } from '../src/profile/profile.module';
import { TestHealthModule } from './test-health.module';
import { AppPrometheusModule } from '../src/common/prometheus/prometheus.module';
import { TestConfigModule } from './test-config.module';

@Module({
  imports: [
    // --- Test Config Module (without startup validation) ---
    TestConfigModule,
    
    // --- Throttler Module for Rate Limiting ---
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 60, // 60 requests per minute
      },
    ]),

    // --- TypeORM Module (PostgreSQL) ---
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
        synchronize: false,
      }),
    }),

    // --- Cache Module (In-Memory for tests) ---
    CacheModule.register({
      isGlobal: true,
    }),

    // --- Custom Modules ---
    IntegrationsModule,
    UserModule,
    AuthModule,
    ProfileModule,
    TestHealthModule,
    AppPrometheusModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class TestAppModule {}
