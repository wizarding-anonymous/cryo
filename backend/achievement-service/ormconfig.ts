import { DataSource } from 'typeorm';
import { Achievement } from './src/achievement/entities/achievement.entity';
import { UserAchievement } from './src/achievement/entities/user-achievement.entity';
import { UserProgress } from './src/achievement/entities/user-progress.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'achievement_service',
  entities: [Achievement, UserAchievement, UserProgress],
  migrations: ['src/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});