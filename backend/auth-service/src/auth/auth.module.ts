import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenModule } from '../token/token.module';
import { HttpClientModule } from '../common/http-client/http-client.module';
import { RedisModule } from '../common/redis/redis.module';
import { DatabaseModule } from '../database/database.module';
import { SessionModule } from '../session/session.module';
import { ValidationModule } from '../common/validators/validation.module';
import { EventsModule } from '../events/events.module';
import { SagaModule } from '../saga/saga.module';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Module({
  imports: [
    PassportModule,
    TokenModule,
    HttpClientModule,
    RedisModule,
    DatabaseModule,
    SessionModule,
    ValidationModule,
    EventsModule,
    SagaModule,
    MonitoringModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1h'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, TokenModule, SessionModule],
})
export class AuthModule {}