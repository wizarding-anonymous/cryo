import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LibraryGame } from '../entities/library-game.entity';
import { PurchaseHistory } from '../entities/purchase-history.entity';
import { createDatabaseConfig } from './database.config';
import { DatabaseHealthService } from './database-health.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: createDatabaseConfig,
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([LibraryGame, PurchaseHistory]),
  ],
  providers: [DatabaseHealthService],
  exports: [TypeOrmModule, DatabaseHealthService],
})
export class DatabaseModule {}
