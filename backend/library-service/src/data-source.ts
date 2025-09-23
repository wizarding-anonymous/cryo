import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { LibraryGame } from './entities/library-game.entity';
import { PurchaseHistory } from './entities/purchase-history.entity';

// Load environment variables
config();

const configService = new ConfigService();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: configService.get('DATABASE_HOST', 'localhost'),
  port: configService.get('DATABASE_PORT', 5432),
  username: configService.get('DATABASE_USERNAME', 'postgres'),
  password: configService.get('DATABASE_PASSWORD', 'password'),
  database: configService.get('DATABASE_NAME', 'library_service'),
  entities: [LibraryGame, PurchaseHistory],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false, // Always false for production safety
  logging: configService.get('NODE_ENV') === 'development',
  migrationsRun: false, // Migrations should be run manually or via script
  migrationsTableName: 'migrations',
  extra: {
    max: parseInt(configService.get('DATABASE_MAX_CONNECTIONS', '20'), 10),
    min: parseInt(configService.get('DATABASE_MIN_CONNECTIONS', '5'), 10),
    acquireTimeoutMillis: parseInt(
      configService.get('DATABASE_ACQUIRE_TIMEOUT', '60000'),
      10,
    ),
    idleTimeoutMillis: parseInt(
      configService.get('DATABASE_IDLE_TIMEOUT', '600000'),
      10,
    ),
  },
});
