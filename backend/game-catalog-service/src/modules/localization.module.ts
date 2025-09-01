import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocalizationService } from '../application/services/localization.service';
import { LocalizationController } from '../infrastructure/http/controllers/localization.controller';
import { GameTranslation } from '../domain/entities/game-translation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GameTranslation])],
  providers: [LocalizationService],
  controllers: [LocalizationController],
})
export class LocalizationModule {}
