import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Notification, NotificationSettings } from '../entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST', 'localhost'),
        port: configService.get('DATABASE_PORT', 5433),
        username: configService.get('DATABASE_USERNAME', 'notification_user'),
        password: configService.get('DATABASE_PASSWORD', 'notification_password'),
        database: configService.get('DATABASE_NAME', 'notification_db'),
        entities: [Notification, NotificationSettings],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development',
        autoLoadEntities: true,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Notification, NotificationSettings]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}