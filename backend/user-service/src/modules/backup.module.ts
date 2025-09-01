import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BackupService } from '../application/services/backup.service';
import { BackupController } from '../infrastructure/http/controllers/backup.controller';
import { User } from '../domain/entities/user.entity';
import { ReputationEntry } from '../domain/entities/reputation-entry.entity';
import { RoleModule } from './role.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, ReputationEntry]), ScheduleModule.forRoot(), RoleModule],
  controllers: [BackupController],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}
