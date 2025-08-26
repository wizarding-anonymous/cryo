import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CorporateProfile } from '../domain/entities/corporate-profile.entity';
import { CorporateService } from '../application/services/corporate.service';
import { CorporateController } from '../infrastructure/http/controllers/corporate.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CorporateProfile])],
  providers: [CorporateService],
  controllers: [CorporateController],
})
export class CorporateModule {}
