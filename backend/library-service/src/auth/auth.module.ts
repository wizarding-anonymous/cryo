import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OwnershipGuard } from './guards/ownership.guard';
import { RoleGuard } from './guards/role.guard';
import { InternalAuthGuard } from './guards/internal-auth.guard';
import { LibraryModule } from '../library/library.module';
import { ClientsModule } from '../clients/clients.module';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule, // Import ConfigModule for guards that need ConfigService
    LibraryModule,
    ClientsModule, // Import ClientsModule to access UserServiceClient
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret', 'your-secret-key'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn', '1h'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    JwtStrategy,
    JwtAuthGuard,
    OwnershipGuard,
    RoleGuard,
    InternalAuthGuard,
  ],
  exports: [
    JwtAuthGuard,
    OwnershipGuard,
    RoleGuard,
    InternalAuthGuard,
    PassportModule,
  ],
})
export class AuthModule {}
