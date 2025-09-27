import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Achievement } from '../src/achievement/entities/achievement.entity';
import { UserAchievement } from '../src/achievement/entities/user-achievement.entity';
import { UserProgress } from '../src/achievement/entities/user-progress.entity';

export const testDatabaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5433'),
  username: process.env.TEST_DB_USERNAME || 'postgres',
  password: process.env.TEST_DB_PASSWORD || 'password',
  database: process.env.TEST_DB_NAME || 'achievement_service_test',
  entities: [Achievement, UserAchievement, UserProgress],
  synchronize: true, // Use synchronize for tests
  dropSchema: true, // Drop schema before each test run
  logging: false,
  keepConnectionAlive: false,
};
