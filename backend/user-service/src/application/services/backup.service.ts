import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { ReputationEntry } from '../../domain/entities/reputation-entry.entity';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental';
  size: number;
  checksum: string;
  tables: string[];
  status: 'in_progress' | 'completed' | 'failed';
  error?: string;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir = process.env.BACKUP_DIR || './backups';
  private isBackupInProgress = false;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ReputationEntry)
    private readonly reputationRepository: Repository<ReputationEntry>,
    private readonly dataSource: DataSource,
  ) {
    this.ensureBackupDirectory();
  }

  /**
   * Автоматическое создание резервных копий каждый час
   */
  @Cron(CronExpression.EVERY_HOUR)
  async performScheduledBackup(): Promise<void> {
    if (this.isBackupInProgress) {
      this.logger.warn('Backup already in progress, skipping scheduled backup');
      return;
    }

    try {
      await this.createIncrementalBackup();
    } catch (error) {
      this.logger.error('Scheduled backup failed', error.message);
    }
  }

  /**
   * Полное резервное копирование (ежедневно в 2:00)
   */
  @Cron('0 2 * * *')
  async performFullBackup(): Promise<void> {
    if (this.isBackupInProgress) {
      this.logger.warn('Backup already in progress, skipping full backup');
      return;
    }

    try {
      await this.createFullBackup();
    } catch (error) {
      this.logger.error('Full backup failed', error.message);
    }
  }

  /**
   * Создание полной резервной копии
   */
  async createFullBackup(): Promise<BackupMetadata> {
    this.logger.log('Starting full backup...');
    this.isBackupInProgress = true;

    const backupId = `full_${Date.now()}`;
    const timestamp = new Date();

    const metadata: BackupMetadata = {
      id: backupId,
      timestamp,
      type: 'full',
      size: 0,
      checksum: '',
      tables: ['users', 'reputation_history', 'user_sessions', 'social_accounts'],
      status: 'in_progress',
    };

    try {
      const backupPath = path.join(this.backupDir, `${backupId}.sql`);

      // Создаем SQL дамп всех таблиц
      const sqlDump = await this.createSQLDump(metadata.tables);

      // Сохраняем в файл
      await fs.writeFile(backupPath, sqlDump, 'utf8');

      // Вычисляем размер и контрольную сумму
      const stats = await fs.stat(backupPath);
      metadata.size = stats.size;
      metadata.checksum = await this.calculateChecksum(backupPath);
      metadata.status = 'completed';

      // Сохраняем метаданные
      await this.saveBackupMetadata(metadata);

      this.logger.log(`Full backup completed: ${backupId}, size: ${metadata.size} bytes`);

      // Очищаем старые резервные копии
      await this.cleanupOldBackups();

      return metadata;
    } catch (error) {
      metadata.status = 'failed';
      metadata.error = error.message;
      await this.saveBackupMetadata(metadata);

      this.logger.error(`Full backup failed: ${error.message}`);
      throw error;
    } finally {
      this.isBackupInProgress = false;
    }
  }

  /**
   * Создание инкрементальной резервной копии
   */
  async createIncrementalBackup(): Promise<BackupMetadata> {
    this.logger.log('Starting incremental backup...');
    this.isBackupInProgress = true;

    const backupId = `incremental_${Date.now()}`;
    const timestamp = new Date();

    // Получаем время последнего бэкапа
    const lastBackupTime = await this.getLastBackupTime();

    const metadata: BackupMetadata = {
      id: backupId,
      timestamp,
      type: 'incremental',
      size: 0,
      checksum: '',
      tables: ['users', 'reputation_history'],
      status: 'in_progress',
    };

    try {
      const backupPath = path.join(this.backupDir, `${backupId}.sql`);

      // Создаем инкрементальный дамп (только измененные данные)
      const sqlDump = await this.createIncrementalSQLDump(lastBackupTime);

      // Сохраняем в файл
      await fs.writeFile(backupPath, sqlDump, 'utf8');

      // Вычисляем размер и контрольную сумму
      const stats = await fs.stat(backupPath);
      metadata.size = stats.size;
      metadata.checksum = await this.calculateChecksum(backupPath);
      metadata.status = 'completed';

      // Сохраняем метаданные
      await this.saveBackupMetadata(metadata);

      this.logger.log(`Incremental backup completed: ${backupId}, size: ${metadata.size} bytes`);

      return metadata;
    } catch (error) {
      metadata.status = 'failed';
      metadata.error = error.message;
      await this.saveBackupMetadata(metadata);

      this.logger.error(`Incremental backup failed: ${error.message}`);
      throw error;
    } finally {
      this.isBackupInProgress = false;
    }
  }

  /**
   * Восстановление из резервной копии
   */
  async restoreFromBackup(backupId: string): Promise<void> {
    this.logger.log(`Starting restore from backup: ${backupId}`);

    const metadata = await this.getBackupMetadata(backupId);
    if (!metadata) {
      throw new Error(`Backup ${backupId} not found`);
    }

    if (metadata.status !== 'completed') {
      throw new Error(`Backup ${backupId} is not completed or failed`);
    }

    const backupPath = path.join(this.backupDir, `${backupId}.sql`);

    try {
      // Проверяем целостность файла
      const currentChecksum = await this.calculateChecksum(backupPath);
      if (currentChecksum !== metadata.checksum) {
        throw new Error('Backup file is corrupted (checksum mismatch)');
      }

      // Читаем SQL дамп
      const sqlDump = await fs.readFile(backupPath, 'utf8');

      // Выполняем восстановление в транзакции
      await this.dataSource.transaction(async manager => {
        // Очищаем существующие данные (осторожно!)
        await manager.query('TRUNCATE TABLE reputation_history CASCADE');
        await manager.query('TRUNCATE TABLE user_sessions CASCADE');
        await manager.query('TRUNCATE TABLE social_accounts CASCADE');
        await manager.query('TRUNCATE TABLE users CASCADE');

        // Выполняем SQL дамп
        await manager.query(sqlDump);
      });

      this.logger.log(`Restore from backup ${backupId} completed successfully`);
    } catch (error) {
      this.logger.error(`Restore from backup ${backupId} failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получение списка доступных резервных копий
   */
  async getAvailableBackups(): Promise<BackupMetadata[]> {
    try {
      const metadataFiles = await fs.readdir(this.backupDir);
      const backups: BackupMetadata[] = [];

      for (const file of metadataFiles) {
        if (file.endsWith('.metadata.json')) {
          const metadataPath = path.join(this.backupDir, file);
          const content = await fs.readFile(metadataPath, 'utf8');
          const metadata = JSON.parse(content) as BackupMetadata;
          backups.push(metadata);
        }
      }

      // Сортируем по времени создания (новые первыми)
      return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      this.logger.error('Failed to get available backups', error.message);
      return [];
    }
  }

  /**
   * Проверка целостности резервной копии
   */
  async verifyBackupIntegrity(backupId: string): Promise<boolean> {
    try {
      const metadata = await this.getBackupMetadata(backupId);
      if (!metadata) {
        return false;
      }

      const backupPath = path.join(this.backupDir, `${backupId}.sql`);
      const currentChecksum = await this.calculateChecksum(backupPath);

      return currentChecksum === metadata.checksum;
    } catch (error) {
      this.logger.error(`Failed to verify backup integrity: ${error.message}`);
      return false;
    }
  }

  /**
   * Создание SQL дампа
   */
  private async createSQLDump(tables: string[]): Promise<string> {
    let sqlDump = '';

    for (const table of tables) {
      // Получаем данные из таблицы
      const data = await this.dataSource.query(`SELECT * FROM ${table}`);

      if (data.length > 0) {
        // Создаем INSERT statements
        const columns = Object.keys(data[0]);
        const columnsList = columns.map(col => `"${col}"`).join(', ');

        sqlDump += `-- Data for table ${table}\n`;

        for (const row of data) {
          const values = columns
            .map(col => {
              const value = row[col];
              if (value === null) return 'NULL';
              if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
              if (value instanceof Date) return `'${value.toISOString()}'`;
              if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
              return value;
            })
            .join(', ');

          sqlDump += `INSERT INTO ${table} (${columnsList}) VALUES (${values});\n`;
        }

        sqlDump += '\n';
      }
    }

    return sqlDump;
  }

  /**
   * Создание инкрементального SQL дампа
   */
  private async createIncrementalSQLDump(since: Date): Promise<string> {
    let sqlDump = '';

    // Пользователи, созданные или обновленные после последнего бэкапа
    const users = await this.userRepository
      .createQueryBuilder('user')
      .where('user.createdAt > :since OR user.updatedAt > :since', { since })
      .getMany();

    if (users.length > 0) {
      sqlDump += '-- Incremental data for users\n';
      for (const user of users) {
        sqlDump += `INSERT INTO users VALUES (...) ON CONFLICT (id) DO UPDATE SET ...;\n`;
      }
      sqlDump += '\n';
    }

    // Записи репутации после последнего бэкапа
    const reputationEntries = await this.reputationRepository
      .createQueryBuilder('entry')
      .where('entry.createdAt > :since', { since })
      .getMany();

    if (reputationEntries.length > 0) {
      sqlDump += '-- Incremental data for reputation_history\n';
      for (const entry of reputationEntries) {
        sqlDump += `INSERT INTO reputation_history VALUES (...);\n`;
      }
    }

    return sqlDump;
  }

  /**
   * Вычисление контрольной суммы файла
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Сохранение метаданных резервной копии
   */
  private async saveBackupMetadata(metadata: BackupMetadata): Promise<void> {
    const metadataPath = path.join(this.backupDir, `${metadata.id}.metadata.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  }

  /**
   * Получение метаданных резервной копии
   */
  private async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    try {
      const metadataPath = path.join(this.backupDir, `${backupId}.metadata.json`);
      const content = await fs.readFile(metadataPath, 'utf8');
      return JSON.parse(content) as BackupMetadata;
    } catch (error) {
      return null;
    }
  }

  /**
   * Получение времени последнего бэкапа
   */
  private async getLastBackupTime(): Promise<Date> {
    const backups = await this.getAvailableBackups();
    if (backups.length === 0) {
      // Если бэкапов нет, возвращаем время 24 часа назад
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }

    return new Date(backups[0].timestamp);
  }

  /**
   * Очистка старых резервных копий
   */
  private async cleanupOldBackups(): Promise<void> {
    const backups = await this.getAvailableBackups();
    const maxBackups = parseInt(process.env.MAX_BACKUPS || '30');

    if (backups.length > maxBackups) {
      const backupsToDelete = backups.slice(maxBackups);

      for (const backup of backupsToDelete) {
        try {
          const backupPath = path.join(this.backupDir, `${backup.id}.sql`);
          const metadataPath = path.join(this.backupDir, `${backup.id}.metadata.json`);

          await fs.unlink(backupPath);
          await fs.unlink(metadataPath);

          this.logger.log(`Deleted old backup: ${backup.id}`);
        } catch (error) {
          this.logger.error(`Failed to delete backup ${backup.id}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Создание директории для резервных копий
   */
  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.access(this.backupDir);
    } catch (error) {
      await fs.mkdir(this.backupDir, { recursive: true });
      this.logger.log(`Created backup directory: ${this.backupDir}`);
    }
  }
}
