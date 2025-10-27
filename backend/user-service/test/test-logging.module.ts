import { Module, Global } from '@nestjs/common';
import { LoggingService } from '../src/common/logging/logging.service';
import { AuditService } from '../src/common/logging/audit.service';
import { createMockLoggingService, createMockAuditService } from './mocks/logging.service.mock';

@Global()
@Module({
  providers: [
    {
      provide: LoggingService,
      useValue: createMockLoggingService(),
    },
    {
      provide: AuditService,
      useValue: createMockAuditService(),
    },
  ],
  exports: [
    LoggingService,
    AuditService,
  ],
})
export class TestLoggingModule {}