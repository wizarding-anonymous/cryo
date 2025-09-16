import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IPBlock } from '../../entities/ip-block.entity';
import { SecurityEvent } from '../../entities/security-event.entity';
import { RateLimitService } from './rate-limit.service';
import { SecurityService } from './security.service';
import { LogsModule } from '../logs/logs.module';
import { ClientsModule } from '../../clients/clients.module';
import { AdminGuard } from '../../common/guards/admin.guard';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { AuthService } from '../../common/auth/auth.service';
import { SecurityController } from './security.controller';

@Module({
  imports: [TypeOrmModule.forFeature([IPBlock, SecurityEvent]), LogsModule, ClientsModule],
  controllers: [SecurityController],
  providers: [RateLimitService, SecurityService, AdminGuard, RateLimitGuard, AuthService],
  exports: [RateLimitService, SecurityService],
})
export class SecurityModule {}
