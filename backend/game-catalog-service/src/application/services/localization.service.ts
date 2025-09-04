import { Injectable } from '@nestjs/common';
import { GameTranslation } from '../../domain/entities/game-translation.entity';
import { Game } from '../../domain/entities/game.entity';
import * as acceptLanguageParser from 'accept-language-parser';
import { GameTranslationRepository } from '../../infrastructure/persistence/game-translation.repository';

@Injectable()
export class LocalizationService {
  private readonly defaultLanguage = 'ru'; // Assuming Russian is the default

  constructor(
    private readonly translationRepository: GameTranslationRepository,
  ) {}

  async getTranslationsForGames(gameIds: string[], languageCode: string): Promise<Map<string, GameTranslation>> {
    const translationsMap = new Map<string, GameTranslation>();

    const requestedTranslations = await this.translationRepository.findForGames(gameIds, languageCode);
    for (const t of requestedTranslations) {
      translationsMap.set(t.gameId, t);
    }

    if (languageCode !== this.defaultLanguage) {
      const missingGameIds = gameIds.filter(id => !translationsMap.has(id));
      if (missingGameIds.length > 0) {
        const fallbackTranslations = await this.translationRepository.findForGames(missingGameIds, this.defaultLanguage);
        for (const t of fallbackTranslations) {
          translationsMap.set(t.gameId, t);
        }
      }
    }

    return translationsMap;
  }

  async addOrUpdateTranslation(
    gameId: string,
    languageCode: string,
    data: { title: string; description?: string; shortDescription?: string },
  ): Promise<GameTranslation> {
    let translation = await this.translationRepository.findOne({ gameId, languageCode });

    if (translation) {
      Object.assign(translation, data);
    } else {
      translation = this.translationRepository.create({
        gameId,
        languageCode,
        ...data,
      });
    }

    return this.translationRepository.save(translation);
  }

  async getTranslationWithFallback(gameId: string, languageCode: string): Promise<GameTranslation | null> {
    let translation = await this.translationRepository.findOne({ gameId, languageCode });

    if (!translation && languageCode !== this.defaultLanguage) {
      translation = await this.translationRepository.findOne({ gameId, languageCode: this.defaultLanguage });
    }

    return translation;
  }

  applyTranslation(game: Game, translation: GameTranslation): Game {
    if (!translation) {
      return game;
    }
    const localizedGame = { ...game };
    localizedGame.title = translation.title;
    localizedGame.description = translation.description;
    localizedGame.shortDescription = translation.shortDescription;
    return localizedGame;
  }

  getLanguageFromHeader(acceptLanguageHeader: string | undefined): string {
    if (!acceptLanguageHeader) {
      return this.defaultLanguage;
    }
    const languages = acceptLanguageParser.parse(acceptLanguageHeader);
    return languages.length > 0 ? languages[0].code : this.defaultLanguage;
  }
}
