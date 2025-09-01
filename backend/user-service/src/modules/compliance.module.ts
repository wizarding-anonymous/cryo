import { Module } from '@nestjs/common';
import { MockGOSTEncryptionService } from '../application/services/mock-gost-encryption.service';
import { DataComplianceController } from '../infrastructure/http/controllers/data-compliance.controller';

@Module({
  providers: [MockGOSTEncryptionService],
  controllers: [DataComplianceController],
})
export class ComplianceModule {}
