import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { Review } from '../entities/review.entity';
import { GameRating } from '../entities/game-rating.entity';

// Load environment variables
config();

const configService = new ConfigService();

export default new DataSource({
  type: 'postgres',
  host: configService.get('DATABASE_HOST') || 'localhost',
  port: parseInt(configService.get('DATABASE_PORT') || '5432', 10),
  username: configService.get('DATABASE_USERNAME') || 'review_user',
  password: configService.get('DATABASE_PASSWORD') || 'review_password',
  database: configService.get('DATABASE_NAME') || 'review_db',
  entities: [Review, GameRating],
  migrations: ['src/migrations/*{.ts,.js}'],
  synchronize: false, // Always false for migrations
  logging: configService.get('NODE_ENV') === 'development',
});