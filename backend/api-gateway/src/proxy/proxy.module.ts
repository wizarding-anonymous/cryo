import { Module } from '@nestjs/common';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';
import { ServiceRegistryModule } from '../registry/service-registry.module';
import { InterceptorsModule } from '../shared/interceptors/interceptors.module';
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../security/guards/optional-auth.guard';
import { RateLimitGuard } from '../security/guards/rate-limit.guard';
import { AuthValidationService } from '../security/auth-validation.service';
import { RateLimitService } from '../security/rate-limit.service';

@Module({
  imports: [ServiceRegistryModule, InterceptorsModule],
  controllers: [ProxyController],
  providers: [
    ProxyService,
    // Provide guards for DI
    JwtAuthGuard,
    OptionalAuthGuard,
    RateLimitGuard,
    RateLimitService,
    AuthValidationService,
  ],
  exports: [ProxyService],
})
export class ProxyModule {}
