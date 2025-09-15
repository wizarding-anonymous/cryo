import 'dotenv/config';
import { DataSource } from 'typeorm';
import { SecurityEvent } from './src/entities/security-event.entity';
import { SecurityAlert } from './src/entities/security-alert.entity';
import { IPBlock } from './src/entities/ip-block.entity';

const databaseUrl = process.env.DATABASE_URL;

export default new DataSource({
  type: 'postgres',
  url: databaseUrl,
  host: databaseUrl ? undefined : process.env.DB_HOST || 'localhost',
  port: databaseUrl ? undefined : Number(process.env.DB_PORT || 5432),
  username: databaseUrl ? undefined : process.env.DB_USER || 'postgres',
  password: databaseUrl ? undefined : process.env.DB_PASSWORD || 'postgres',
  database: databaseUrl ? undefined : process.env.DB_NAME || 'security_service',
  entities: [SecurityEvent, SecurityAlert, IPBlock],
  migrations: ['src/database/migrations/*.{ts,js}'],
  synchronize: false,
  logging: false,
});

