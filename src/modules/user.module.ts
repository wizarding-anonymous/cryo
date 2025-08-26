import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../domain/entities/user.entity';
import { UserService } from '../application/services/user.service';
import { UserController } from '../infrastructure/http/controllers/user.controller';
import { MockEmailService } from '../application/services/mock-email.service';
import { IEmailService } from '../domain/interfaces/email.interface';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [
    UserService,
    {
      provide: IEmailService,
      useClass: MockEmailService,
    },
  ],
  controllers: [UserController],
})
export class UserModule {}
