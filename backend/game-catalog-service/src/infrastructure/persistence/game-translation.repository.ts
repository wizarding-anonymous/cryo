import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { GameTranslation } from '../../domain/entities/game-translation.entity';

@Injectable()
export class GameTranslationRepository {
  constructor(
    @InjectRepository(GameTranslation)
    private readonly repository: Repository<GameTranslation>,
  ) {}

  async findOne(where: { gameId: string, languageCode: string }): Promise<GameTranslation | null> {
    return this.repository.findOne({ where });
  }

  async findForGames(gameIds: string[], languageCode: string): Promise<GameTranslation[]> {
    if (gameIds.length === 0) {
      return [];
    }
    return this.repository.find({
      where: {
        gameId: In(gameIds),
        languageCode,
      },
    });
  }

  create(data: Partial<GameTranslation>): GameTranslation {
    return this.repository.create(data);
  }

  save(translation: GameTranslation): Promise<GameTranslation> {
    return this.repository.save(translation);
  }
}
