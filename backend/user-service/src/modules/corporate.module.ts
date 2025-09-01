import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CorporateProfile } from '../domain/entities/corporate-profile.entity';
import { User } from '../domain/entities/user.entity';
import { CorporateService } from '../application/services/corporate.service';
import { CorporateSSOService } from '../application/services/corporate-sso.service';
import { RussianSSOService } from '../application/services/russian-sso.service';
import { CorporateController } from '../infrastructure/http/controllers/corporate.controller';
import { EventsModule } from '../application/events/events.module';
import { AuthModule } from './auth.module';
import { RoleModule } from './role.module';

@Module({
  imports: [TypeOrmModule.forFeature([CorporateProfile, User]), EventsModule, AuthModule, RoleModule],
  providers: [CorporateService, CorporateSSOService, RussianSSOService],
  controllers: [CorporateController],
  exports: [CorporateService, CorporateSSOService],
})
export class CorporateModule {}
