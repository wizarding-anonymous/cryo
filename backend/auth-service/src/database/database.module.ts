import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getDatabaseConfig } from './database.config';
import { DatabaseService } from './database.service';
import { DatabaseOperationsService } from './database-operations.service';
import { AuthDatabaseService } from './auth-database.service';
import { MigrationService } from './migration.service';
import { DatabaseCliService } from './database-cli.service';
import { RepositoryModule } from '../repositories/repository.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => getDatabaseConfig(configService),
      inject: [ConfigService],
    }),
    RepositoryModule,
  ],
  providers: [
    DatabaseService, 
    DatabaseOperationsService, 
    AuthDatabaseService,
    MigrationService, 
    DatabaseCliService,
  ],
  exports: [
    TypeOrmModule, 
    DatabaseService, 
    DatabaseOperationsService, 
    AuthDatabaseService,
    MigrationService, 
    DatabaseCliService,
    RepositoryModule,
  ],
})
export class DatabaseModule { }