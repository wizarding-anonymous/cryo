import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../domain/entities/user.entity';
import { UserService } from '../application/services/user.service';
import { UserController } from '../infrastructure/http/controllers/user.controller';
import { MockEmailService } from '../application/services/mock-email.service';
import { IEmailService } from '../domain/interfaces/email.interface';
import { AuthModule } from './auth.module';
import { MockAvatarService } from '../application/services/mock-avatar.service';
import { IntegrationModule } from './integration.module';
import { SessionModule } from './session.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AuthModule, IntegrationModule, SessionModule],
  providers: [
    UserService,
    MockAvatarService,
    {
      provide: IEmailService,
      useClass: MockEmailService,
    },
  ],
  controllers: [UserController],
  exports: [UserService], // Export UserService so other modules can use it
})
export class UserModule {}
