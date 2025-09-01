import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SessionService } from '../application/services/session.service';
import { Session } from '../domain/entities/session.entity';
import { User } from '../domain/entities/user.entity';
import { EventsModule } from '../application/events/events.module';
import { SessionCleanupTask } from '../application/tasks/session-cleanup.task';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session, User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'your-secret-key'),
        signOptions: { expiresIn: configService.get<string>('JWT_EXPIRES_IN', '15m') },
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    EventsModule,
  ],
  providers: [SessionService, SessionCleanupTask],
  exports: [SessionService],
})
export class SessionModule {}
