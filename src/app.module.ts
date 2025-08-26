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
import { OutboxEvent } from './domain/entities/outbox-event.entity';
import { UserToken } from './domain/entities/user-token.entity';
import { Role } from './domain/entities/role.entity';
import { UserRole } from './domain/entities/user-role.entity';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import { KafkaModule } from './infrastructure/event-emitters/kafka.module';
import { EventsModule } from './application/events/events.module';
import { DeveloperModule } from './modules/developer.module';
import { PublisherModule } from './modules/publisher.module';
import { VerificationModule } from './modules/verification.module';
import { UserModule } from './modules/user.module';
import { AuthModule } from './modules/auth.module';
import { MfaModule } from './modules/mfa.module';
import { OAuthModule } from './modules/oauth.module';
import { ProfileModule } from './modules/profile.module';
import { CorporateModule } from './modules/corporate.module';
import { RoleModule } from './modules/role.module';
import { CustomizationModule } from './modules/customization.module';
import { ReputationModule } from './modules/reputation.module';

@Module({
  imports: [
    KafkaModule,
    EventsModule,
    DeveloperModule,
    PublisherModule,
    VerificationModule,
    UserModule,
    AuthModule,
    MfaModule,
    OAuthModule,
    ProfileModule,
    CorporateModule,
    RoleModule,
    CustomizationModule,
    ReputationModule,
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
          OutboxEvent,
          UserToken,
          Role,
          UserRole,
        ],
        synchronize: false, // Use migrations instead
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
