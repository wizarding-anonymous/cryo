import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './infrastructure/http/app.controller';
import { AppService } from './application/use-cases/app.service';
import { User } from './domain/entities/user.entity';
import { Session } from './domain/entities/session.entity';
import { SocialAccount } from './domain/entities/social-account.entity';
import { DeveloperProfile } from './domain/entities/developer-profile.entity';
import { PublisherProfile } from './domain/entities/publisher-profile.entity';
import { CorporateProfile } from './domain/entities/corporate-profile.entity';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get<string>('REDIS_HOST'),
        port: configService.get<number>('REDIS_PORT'),
      }),
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('POSTGRES_HOST'),
        port: configService.get<number>('POSTGRES_PORT'),
        username: configService.get<string>('POSTGRES_USER'),
        password: configService.get<string>('POSTGRES_PASSWORD'),
        database: configService.get<string>('POSTGRES_DB'),
        entities: [
          User,
          Session,
          SocialAccount,
          DeveloperProfile,
          PublisherProfile,
          CorporateProfile,
        ],
        synchronize: false, // Use migrations instead
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
