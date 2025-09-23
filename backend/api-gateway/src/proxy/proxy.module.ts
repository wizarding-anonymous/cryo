import { Module } from '@nestjs/common';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';
import { ServiceRegistryModule } from '../registry/service-registry.module';
import { LoggingInterceptor } from '../shared/interceptors/logging.interceptor';
import { ResponseInterceptor } from '../shared/interceptors/response.interceptor';
import { CacheInterceptor } from '../shared/interceptors/cache.interceptor';
import { CorsInterceptor } from '../shared/interceptors/cors.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../security/guards/optional-auth.guard';
import { RateLimitGuard } from '../security/guards/rate-limit.guard';
import { AuthValidationService } from '../security/auth-validation.service';
import { RateLimitService } from '../security/rate-limit.service';

@Module({
  imports: [ServiceRegistryModule],
  controllers: [ProxyController],
  providers: [
    ProxyService,
    // Provide guards for DI; they will be implemented in tasks 5-6.
    JwtAuthGuard,
    OptionalAuthGuard,
    RateLimitGuard,
    RateLimitService,
    AuthValidationService,
    // Interceptors are applied at controller level, but available via DI
    LoggingInterceptor,
    ResponseInterceptor,
    CacheInterceptor,
    CorsInterceptor,
    // Optionally register logging interceptor globally later if needed
    // { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
  exports: [ProxyService],
})
export class ProxyModule {}
