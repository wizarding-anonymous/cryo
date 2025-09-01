import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomizationService } from '../application/services/customization.service';
import { CustomizationController } from '../infrastructure/http/controllers/customization.controller';
import { User } from '../domain/entities/user.entity';
import { EventsModule } from '../application/events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), EventsModule],
  providers: [CustomizationService],
  controllers: [CustomizationController],
  exports: [CustomizationService],
})
export class CustomizationModule {}
