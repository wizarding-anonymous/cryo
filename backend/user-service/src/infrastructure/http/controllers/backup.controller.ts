import { Controller, Get, Post, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BackupService, BackupMetadata } from '../../../application/services/backup.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('backup')
@Controller('backup')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post('full')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Создать полную резервную копию' })
  @ApiResponse({ status: 202, description: 'Резервное копирование запущено' })
  @ApiResponse({ status: 403, description: 'Недостаточно прав доступа' })
  async createFullBackup(): Promise<{ message: string; backupId?: string }> {
    try {
      const metadata = await this.backupService.createFullBackup();
      return {
        message: 'Full backup completed successfully',
        backupId: metadata.id,
      };
    } catch (error) {
      return {
        message: `Full backup failed: ${error.message}`,
      };
    }
  }

  @Post('incremental')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Создать инкрементальную резервную копию' })
  @ApiResponse({ status: 202, description: 'Инкрементальное резервное копирование запущено' })
  async createIncrementalBackup(): Promise<{ message: string; backupId?: string }> {
    try {
      const metadata = await this.backupService.createIncrementalBackup();
      return {
        message: 'Incremental backup completed successfully',
        backupId: metadata.id,
      };
    } catch (error) {
      return {
        message: `Incremental backup failed: ${error.message}`,
      };
    }
  }

  @Get('list')
  @ApiOperation({ summary: 'Получить список доступных резервных копий' })
  @ApiResponse({ status: 200, description: 'Список резервных копий' })
  async getAvailableBackups(): Promise<{
    backups: BackupMetadata[];
    summary: {
      total: number;
      fullBackups: number;
      incrementalBackups: number;
      totalSize: number;
    };
  }> {
    const backups = await this.backupService.getAvailableBackups();

    const summary = {
      total: backups.length,
      fullBackups: backups.filter(b => b.type === 'full').length,
      incrementalBackups: backups.filter(b => b.type === 'incremental').length,
      totalSize: backups.reduce((sum, b) => sum + b.size, 0),
    };

    return { backups, summary };
  }

  @Post('restore/:backupId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Восстановить из резервной копии' })
  @ApiResponse({ status: 202, description: 'Восстановление запущено' })
  @ApiResponse({ status: 404, description: 'Резервная копия не найдена' })
  async restoreFromBackup(@Param('backupId') backupId: string): Promise<{ message: string }> {
    try {
      await this.backupService.restoreFromBackup(backupId);
      return {
        message: `Restore from backup ${backupId} completed successfully`,
      };
    } catch (error) {
      return {
        message: `Restore from backup ${backupId} failed: ${error.message}`,
      };
    }
  }

  @Get('verify/:backupId')
  @ApiOperation({ summary: 'Проверить целостность резервной копии' })
  @ApiResponse({ status: 200, description: 'Результат проверки целостности' })
  async verifyBackupIntegrity(
    @Param('backupId') backupId: string,
  ): Promise<{ backupId: string; isValid: boolean; message: string }> {
    const isValid = await this.backupService.verifyBackupIntegrity(backupId);

    return {
      backupId,
      isValid,
      message: isValid
        ? 'Backup integrity verified successfully'
        : 'Backup integrity check failed - file may be corrupted',
    };
  }

  @Get('status')
  @ApiOperation({ summary: 'Получить статус системы резервного копирования' })
  @ApiResponse({ status: 200, description: 'Статус системы backup' })
  async getBackupStatus(): Promise<{
    isEnabled: boolean;
    lastFullBackup?: Date;
    lastIncrementalBackup?: Date;
    nextScheduledBackup: string;
    backupDirectory: string;
    retentionPolicy: string;
  }> {
    const backups = await this.backupService.getAvailableBackups();
    const fullBackups = backups.filter(b => b.type === 'full');
    const incrementalBackups = backups.filter(b => b.type === 'incremental');

    return {
      isEnabled: true,
      lastFullBackup: fullBackups.length > 0 ? new Date(fullBackups[0].timestamp) : undefined,
      lastIncrementalBackup: incrementalBackups.length > 0 ? new Date(incrementalBackups[0].timestamp) : undefined,
      nextScheduledBackup: 'Every hour (incremental), Daily at 2:00 AM (full)',
      backupDirectory: process.env.BACKUP_DIR || './backups',
      retentionPolicy: `Keep ${process.env.MAX_BACKUPS || '30'} backups`,
    };
  }
}
