import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Session } from '../entities/session.entity';
import { TokenBlacklist } from '../entities/token-blacklist.entity';
import { LoginAttempt } from '../entities/login-attempt.entity';
import { SecurityEvent } from '../entities/security-event.entity';

/**
 * Конфигурация тестовой базы данных
 * Использует SQLite в памяти для изоляции тестов
 */
export const testDatabaseConfig: TypeOrmModuleOptions = {
  type: 'sqlite',
  database: ':memory:',
  entities: [Session, TokenBlacklist, LoginAttempt, SecurityEvent],
  synchronize: true,
  logging: false,
  dropSchema: true,
};

/**
 * Создает тестовый DataSource для e2e тестов
 */
export const createTestDataSource = async (): Promise<DataSource> => {
  const dataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [Session, TokenBlacklist, LoginAttempt, SecurityEvent],
    synchronize: true,
    logging: false,
    dropSchema: true,
  });

  await dataSource.initialize();
  return dataSource;
};

/**
 * Очищает тестовую базу данных
 */
export const cleanupTestDatabase = async (dataSource: DataSource): Promise<void> => {
  if (!dataSource.isInitialized) {
    return;
  }

  try {
    // Очищаем все таблицы в правильном порядке (учитывая внешние ключи)
    await dataSource.query('DELETE FROM security_events');
    await dataSource.query('DELETE FROM login_attempts');
    await dataSource.query('DELETE FROM token_blacklist');
    await dataSource.query('DELETE FROM sessions');
  } catch (error) {
    console.warn('Test database cleanup warning:', error.message);
  }
};