import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { I18nModule, QueryResolver, AcceptLanguageResolver } from 'nestjs-i18n';
import * as path from 'path';
import { ScheduleModule } from '@nestjs/schedule';
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
import { Discount } from './domain/entities/discount.entity';
import { GameTranslation } from './domain/entities/game-translation.entity';
import { Dlc } from './domain/entities/dlc.entity';
import { Preorder } from './domain/entities/preorder.entity';
import { PreorderTier } from './domain/entities/preorder-tier.entity';
import { Demo } from './domain/entities/demo.entity';
import { GameEdition } from './domain/entities/game-edition.entity';
import { Bundle } from './domain/entities/bundle.entity';
import { Franchise } from './domain/entities/franchise.entity';
import { ElasticsearchModule } from './infrastructure/search/elasticsearch.module';
import { GameModule } from './modules/game.module';
import { SearchModule } from './modules/search.module';
import { CategoryModule } from './modules/category.module';
import { TagModule } from './modules/tag.module';
import { MediaModule } from './modules/media.module';
import { DeveloperModule } from './modules/developer.module';
import { ModerationModule } from './modules/moderation.module';
import { RecommendationModule } from './modules/recommendation.module';
import { PromotionModule } from './modules/promotion.module';
import { LocalizationModule } from './modules/localization.module';
import { DlcModule } from './modules/dlc.module';
import { PreorderModule } from './modules/preorder.module';
import { DemoModule } from './modules/demo.module';
import { EditionModule } from './modules/edition.module';
import { BundleModule } from './modules/bundle.module';
import { FranchiseModule } from './modules/franchise.module';
import { IntegrationModule } from './modules/integration.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig, elasticsearchConfig, s3Config],
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities: [Game, Category, Tag, Screenshot, Video, Discount, GameTranslation, Dlc, Preorder, PreorderTier, Demo, GameEdition, Bundle, Franchise],
        synchronize: true, // Should be false in production, true for local dev
      }),
      inject: [ConfigService],
    }),
    I18nModule.forRoot({
        fallbackLanguage: 'en',
        loaderOptions: {
          path: path.join(__dirname, '/i18n/'),
          watch: true,
        },
        resolvers: [
          { use: QueryResolver, options: ['lang'] },
          AcceptLanguageResolver,
        ],
      }),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('CacheModule');
        try {
          const store = await redisStore({
            socket: {
              host: configService.get<string>('redis.host'),
              port: configService.get<number>('redis.port'),
              connectTimeout: 1000, // 1 second timeout
            },
          });
          logger.log('Successfully connected to Redis for caching.');
          return { store };
        } catch (error) {
          logger.warn('Could not connect to Redis. Falling back to in-memory cache. Error: ' + error.message);
          return { store: 'memory' };
        }
      },
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
    RecommendationModule,
    PromotionModule,
    LocalizationModule,
    DlcModule,
    PreorderModule,
    DemoModule,
    EditionModule,
    BundleModule,
    FranchiseModule,
    IntegrationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
