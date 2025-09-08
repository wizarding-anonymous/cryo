import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameTranslation } from '../../domain/entities/game-translation.entity';

@Injectable()
export class LocalizationService {
  constructor(
    @InjectRepository(GameTranslation)
    private readonly translationRepository: Repository<GameTranslation>,
  ) {}

  async addOrUpdateTranslation(
    gameId: string,
    languageCode: string,
    data: { title: string; description?: string; shortDescription?: string },
  ): Promise<GameTranslation> {
    let translation = await this.translationRepository.findOne({ where: { gameId, languageCode } });

    if (translation) {
      // Update existing translation
      Object.assign(translation, data);
    } else {
      // Create new translation
      translation = this.translationRepository.create({
        gameId,
        languageCode,
        ...data,
      });
    }

    return this.translationRepository.save(translation);
  }

  async getTranslation(gameId: string, languageCode: string): Promise<GameTranslation | null> {
    return this.translationRepository.findOne({ where: { gameId, languageCode } });
  }
}
