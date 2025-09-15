import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private readonly config: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const databaseUrl = this.config.get<string>('DATABASE_URL');
    const isProd = this.config.get<string>('NODE_ENV') === 'production';

    if (databaseUrl) {
      return {
        type: 'postgres',
        url: databaseUrl,
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: true,
        migrations: [__dirname + '/migrations/*{.js,.ts}'],
        ssl: isProd ? { rejectUnauthorized: false } : false,
      };
    }

    return {
      type: 'postgres',
      host: this.config.get<string>('DB_HOST', 'localhost'),
      port: this.config.get<number>('DB_PORT', 5432),
      username: this.config.get<string>('DB_USER', 'postgres'),
      password: this.config.get<string>('DB_PASSWORD', 'postgres'),
      database: this.config.get<string>('DB_NAME', 'security_service'),
      autoLoadEntities: true,
      synchronize: false,
      migrationsRun: true,
      migrations: [__dirname + '/migrations/*{.js,.ts}'],
    };
  }
}
