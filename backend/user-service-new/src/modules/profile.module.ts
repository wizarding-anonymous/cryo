import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../domain/entities/user.entity';
import { ProfileService } from '../application/services/profile.service';
import { ProfileController } from '../infrastructure/http/controllers/profile.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [ProfileService],
  controllers: [ProfileController],
})
export class ProfileModule {}
