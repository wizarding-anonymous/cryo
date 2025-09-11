import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), IntegrationsModule],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService], // Export UserService to make it available to other modules.
})
export class UserModule {}
