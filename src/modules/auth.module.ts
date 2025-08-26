import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../domain/entities/user.entity';
import { UserActivationToken } from '../domain/entities/user-activation-token.entity';
import { AuthService } from '../application/services/auth.service';
import { AuthController } from '../infrastructure/http/controllers/auth.controller';
import { UserActivationService } from '../application/services/user-activation.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserActivationToken])],
  providers: [AuthService, UserActivationService],
  controllers: [AuthController],
})
export class AuthModule {}
