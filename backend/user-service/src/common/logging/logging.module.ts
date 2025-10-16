import { Module, Global } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggingService } from './logging.service';
import { AuditService } from './audit.service';
import { AuditInterceptor } from './audit.interceptor';
import { AuditMaintenanceService } from './audit-maintenance.service';
import { createWinstonConfig } from './winston.config';
import { SecurityModule } from '../../integrations/security/security.module';

@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      useFactory: () => {
        return createWinstonConfig({
          level: process.env.LOG_LEVEL || 'info',
          format: (process.env.LOG_FORMAT as 'json' | 'simple') || 'json',
          nodeEnv: process.env.NODE_ENV || 'development',
          serviceName: 'user-service',
          serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
        });
      },
    }),
    ScheduleModule.forRoot(),
    SecurityModule,
  ],
  providers: [
    LoggingService, 
    AuditService, 
    AuditInterceptor,
    AuditMaintenanceService,
  ],
  exports: [
    LoggingService, 
    AuditService, 
    AuditInterceptor,
    AuditMaintenanceService,
    WinstonModule,
  ],
})
export class LoggingModule {}
