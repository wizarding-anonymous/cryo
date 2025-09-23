import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { DatabaseConfig } from '../config/database.config';
import { CacheConfig } from '../config/cache.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      useClass: CacheConfig,
    }),
  ],
  providers: [DatabaseConfig, CacheConfig],
  exports: [TypeOrmModule, CacheModule],
})
export class DatabaseModule {}
