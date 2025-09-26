import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import servicesConfig from './config/services.config';
import redisConfig from './config/redis.config';
import { validationSchema } from './config/validation.schema';
import { ProxyModule } from './proxy/proxy.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { RedisService } from './redis/redis.service';
import { ServiceRegistryModule } from './registry/service-registry.module';
import { InterceptorsModule } from './shared/interceptors/interceptors.module';
import { ValidationModule } from './common/pipes/validation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [servicesConfig, redisConfig],
      validationSchema,
    }),
    RedisModule.forRootAsync(),
    ServiceRegistryModule,
    InterceptorsModule,
    ValidationModule,
    HealthModule,
    ProxyModule,
  ],
  providers: [RedisService],
})
export class AppModule {}
