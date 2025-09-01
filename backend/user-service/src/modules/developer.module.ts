import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../application/events/events.module';
import { User } from '../domain/entities/user.entity';
import { DeveloperProfile } from '../domain/entities/developer-profile.entity';
import { BasicDeveloperService } from '../application/services/basic-developer.service';
import { BasicDeveloperController } from '../infrastructure/http/controllers/basic-developer.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, DeveloperProfile]), EventsModule],
  providers: [BasicDeveloperService],
  controllers: [BasicDeveloperController],
})
export class DeveloperModule {}
