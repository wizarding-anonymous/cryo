import { Module, Global } from '@nestjs/common';
import { CacheService } from './services/cache.service';
import { CacheWarmingService } from './services/cache-warming.service';
import { PerformanceMonitoringService } from './services/performance-monitoring.service';
import { HttpCacheInterceptor } from './interceptors/http-cache.interceptor';
import { PerformanceInterceptor } from './interceptors/performance.interceptor';
import { TimeoutInterceptor } from './interceptors/timeout.interceptor';
import { ResponseTransformationInterceptor } from './interceptors/response-transformation.interceptor';
import { CacheAdminController } from './controllers/cache-admin.controller';
import { PerformanceMonitoringController } from './controllers/performance-monitoring.controller';
import { DatabaseModule } from '../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [CacheAdminController, PerformanceMonitoringController],
  providers: [
    PerformanceMonitoringService,
    CacheService,
    CacheWarmingService,
    HttpCacheInterceptor,
    PerformanceInterceptor,
    TimeoutInterceptor,
    ResponseTransformationInterceptor,
  ],
  exports: [
    DatabaseModule, // Экспортируем DatabaseModule чтобы RedisConfigService был доступен
    PerformanceMonitoringService,
    CacheService,
    CacheWarmingService,
    HttpCacheInterceptor,
    PerformanceInterceptor,
    TimeoutInterceptor,
    ResponseTransformationInterceptor,
  ],
})
export class CommonModule {}
