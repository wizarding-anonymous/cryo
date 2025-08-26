import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../domain/entities/user.entity';
import { UserToken } from '../domain/entities/user-token.entity';
import { AuthService } from '../application/services/auth.service';
import { AuthController } from '../infrastructure/http/controllers/auth.controller';
import { UserTokenService } from '../application/services/user-token.service';
import { JwtStrategy } from '../infrastructure/auth/strategies/jwt.strategy';
import { PasswordResetService } from '../application/services/password-reset.service';
import { UserModule } from './user.module';

@Module({
  imports: [
    forwardRef(() => UserModule), // Handle circular dependency with UserModule
    TypeOrmModule.forFeature([User, UserToken]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN'),
        },
      }),
    }),
  ],
  providers: [AuthService, UserTokenService, JwtStrategy, PasswordResetService],
  controllers: [AuthController],
  exports: [AuthService, UserTokenService, PasswordResetService],
})
export class AuthModule {}
