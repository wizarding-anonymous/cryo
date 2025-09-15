import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityAlert } from '../../entities/security-alert.entity';
import { SecurityEvent } from '../../entities/security-event.entity';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AuthService } from '../../common/auth/auth.service';
import { MetricsModule } from '../../common/metrics/metrics.module';

@Module({
  imports: [TypeOrmModule.forFeature([SecurityAlert, SecurityEvent]), MetricsModule],
  controllers: [AlertsController],
  providers: [AlertsService, AdminGuard, AuthService],
  exports: [AlertsService],
})
export class AlertsModule {}
