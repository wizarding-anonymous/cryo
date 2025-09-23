import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityAlert } from '../../entities/security-alert.entity';
import { SecurityEvent } from '../../entities/security-event.entity';
import { MonitoringService } from './monitoring.service';
import { AlertsController } from './alerts.controller';
import { AdminGuard } from '../../common/guards/admin.guard';
import { MetricsModule } from '../../common/metrics/metrics.module';
import { EncryptionModule } from '../../common/encryption/encryption.module';
import { KafkaModule } from '../../kafka/kafka.module';
import { AuthModule } from '../../common/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SecurityAlert, SecurityEvent]),
    MetricsModule,
    EncryptionModule,
    KafkaModule,
    AuthModule,
  ],
  controllers: [AlertsController],
  providers: [MonitoringService, AdminGuard],
  exports: [MonitoringService],
})
export class AlertsModule {}
