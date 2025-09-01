import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggingMiddleware } from './infrastructure/middleware/logging.middleware';
// import { AuditInterceptor } from './infrastructure/interceptors/audit.interceptor';
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
import { AuditLog } from './domain/entities/audit-log.entity';
import { ReputationEntry } from './domain/entities/reputation-entry.entity';
import { CacheModule } from '@nestjs/cache-manager';
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
import { AdminModule } from './modules/admin.module';
import { AuditModule } from './modules/audit.module';
import { MonitoringModule } from './modules/monitoring.module';
import { ComplianceModule } from './modules/compliance.module';
import { IntegrationModule } from './modules/integration.module';
import { BackupModule } from './modules/backup.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 100, // 100 requests per minute
      },
    ]),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('POSTGRES_HOST', 'postgres'),
        port: configService.get('POSTGRES_PORT', 5432),
        username: configService.get('POSTGRES_USER', 'user'),
        password: configService.get('POSTGRES_PASSWORD', 'password'),
        database: configService.get('POSTGRES_DB', 'user_service'),
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
          AuditLog,
          ReputationEntry,
        ],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        store: 'redis',
        host: configService.get('REDIS_HOST', 'redis'),
        port: configService.get('REDIS_PORT', 6379),
        ttl: 300, // 5 minutes
      }),
      inject: [ConfigService],
    }),
    KafkaModule,
    EventsModule,
    UserModule,
    AuthModule,
    MfaModule,
    OAuthModule,
    ProfileModule,
    DeveloperModule,
    PublisherModule,
    VerificationModule,
    CorporateModule,
    RoleModule,
    CustomizationModule,
    ReputationModule,
    AdminModule,
    AuditModule,
    MonitoringModule,
    ComplianceModule,
    IntegrationModule,
    BackupModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
