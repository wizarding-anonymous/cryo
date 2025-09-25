import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Review, GameRating } from '../entities';

export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5433', 10),
  username: process.env.DATABASE_USERNAME || 'review_user',
  password: process.env.DATABASE_PASSWORD || 'review_password',
  database: process.env.DATABASE_NAME || 'review_db',
  entities: [Review, GameRating],
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV === 'development',
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  migrationsRun: true,
  migrationsTableName: 'migrations',
});