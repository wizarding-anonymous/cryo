import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import databaseConfig, { redisConfig, elasticsearchConfig, s3Config } from './config/configuration';
import { Game } from './domain/entities/game.entity';
import { Category } from './domain/entities/category.entity';
import { Tag } from './domain/entities/tag.entity';
import { Screenshot } from './domain/entities/screenshot.entity';
import { Video } from './domain/entities/video.entity';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import databaseConfig, { redisConfig, elasticsearchConfig } from './config/configuration';
import { Game } from './domain/entities/game.entity';
import { Category } from './domain/entities/category.entity';
import { Tag } from './domain/entities/tag.entity';
import { Screenshot } from './domain/entities/screenshot.entity';
import { Video } from './domain/entities/video.entity';
import { ElasticsearchModule } from './infrastructure/search/elasticsearch.module';
import { GameModule } from './modules/game.module';
import { SearchModule } from './modules/search.module';
import { CategoryModule } from './modules/category.module';
import { TagModule } from './modules/tag.module';
import { MediaModule } from './modules/media.module';
import { DeveloperModule } from './modules/developer.module';
import { ModerationModule } from './modules/moderation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig, elasticsearchConfig, s3Config],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities: [Game, Category, Tag, Screenshot, Video],
        synchronize: true, // Should be false in production, true for local dev
      }),
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
            socket: {
                host: configService.get<string>('redis.host'),
                port: configService.get<number>('redis.port'),
            }
        }),
      }),
      isGlobal: true,
      inject: [ConfigService],
    }),
    ElasticsearchModule,
    GameModule,
    SearchModule,
    CategoryModule,
    TagModule,
    MediaModule,
    DeveloperModule,
    ModerationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
