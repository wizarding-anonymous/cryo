import { Injectable } from '@nestjs/common';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { Game } from '../../domain/entities/game.entity';
import { In } from 'typeorm';

@Injectable()
export class RecommendationService {
  constructor(private readonly gameRepository: GameRepository) {}

  async findSimilarGames(gameId: string, limit = 5): Promise<Game[]> {
    const game = await this.gameRepository.findById(gameId);
    if (!game || (!game.tags && !game.categories)) {
      return [];
    }

    const tagIds = game.tags?.map(tag => tag.id) || [];
    const categoryIds = game.categories?.map(category => category.id) || [];

    if (tagIds.length === 0 && categoryIds.length === 0) {
        return [];
    }

    // This is a very basic recommendation logic.
    // A real-world implementation would use a more sophisticated algorithm,
    // possibly involving machine learning or a dedicated graph database.
    const similarGames = await this.gameRepository.findSimilar(gameId, categoryIds, tagIds, limit);

    return similarGames;
  }
}
