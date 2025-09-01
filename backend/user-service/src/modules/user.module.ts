import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../domain/entities/user.entity';
import { UserService } from '../application/services/user.service';
import { UserController } from '../infrastructure/http/controllers/user.controller';
import { AuthModule } from './auth.module';
import { MockAvatarService } from '../application/services/mock-avatar.service';
import { MockExternalIntegrationService } from '../application/services/mock-external-integration.service';
import { IntegrationModule } from './integration.module';
import { SessionModule } from './session.module';
import { EmailModule } from './email.module';
import { CircuitBreakerModule } from './circuit-breaker.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AuthModule, IntegrationModule, SessionModule, EmailModule, CircuitBreakerModule],
  providers: [
    UserService,
    MockAvatarService,
    MockExternalIntegrationService,
  ],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
