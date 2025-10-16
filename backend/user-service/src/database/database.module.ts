import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AppConfigModule } from '../config/config.module';
import { ConfigFactory } from '../config/config.factory';
import { EnvironmentVariables } from '../config/env.validation';
import { TypeOrmCacheConnectionProvider } from './typeorm-cache-connection.provider';
import { TypeOrmCacheInterceptor } from './typeorm-cache.interceptor';
import { SlowQueryMonitorService } from './slow-query-monitor.service';
import { SlowQueryController } from './slow-query.controller';
import { CacheModule } from '../common/cache/cache.module';
import { MetricsModule } from '../common/metrics/metrics.module';

@Module({
  imports: [
    AppConfigModule,
    CacheModule,
    forwardRef(() => MetricsModule),
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule, CacheModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables>) => {
        const configFactory = new ConfigFactory(configService);

        // Validate configuration before creating TypeORM config
        configFactory.validateConfiguration();

        return configFactory.createTypeOrmConfig();
      },
    }),
  ],
  providers: [
    TypeOrmCacheConnectionProvider,
    TypeOrmCacheInterceptor,
    SlowQueryMonitorService,
  ],
  controllers: [SlowQueryController],
  exports: [
    TypeOrmModule,
    TypeOrmCacheConnectionProvider,
    TypeOrmCacheInterceptor,
    SlowQueryMonitorService,
  ],
})
export class DatabaseModule {}
