import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocalizationService } from '../application/services/localization.service';
import { LocalizationController } from '../infrastructure/http/controllers/localization.controller';
import { GameTranslation } from '../domain/entities/game-translation.entity';
import { GameTranslationRepository } from '../infrastructure/persistence/game-translation.repository';

@Module({
  imports: [TypeOrmModule.forFeature([GameTranslation])],
  providers: [LocalizationService, GameTranslationRepository],
  controllers: [LocalizationController],
  exports: [LocalizationService],
})
export class LocalizationModule {}
