import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationService } from '../recommendation.service';
import { GameRepository } from '../../../infrastructure/persistence/game.repository';
import { Game } from '../../../domain/entities/game.entity';

const mockGameRepository = {
  findById: jest.fn(),
  findSimilar: jest.fn(),
};

describe('RecommendationService', () => {
  let service: RecommendationService;
  let repository: typeof mockGameRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationService,
        {
          provide: GameRepository,
          useValue: mockGameRepository,
        },
      ],
    }).compile();

    service = module.get<RecommendationService>(RecommendationService);
    repository = module.get(GameRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findSimilarGames', () => {
    it('should return similar games based on tags and categories', async () => {
      const gameId = 'game-1';
      const sourceGame = {
        id: gameId,
        tags: [{ id: 'tag-1', name: 'Action' }],
        categories: [{ id: 'cat-1', name: 'Shooter' }],
      } as unknown as Game;

      const similarGames = [
        { id: 'game-2', title: 'Similar Game 1' },
        { id: 'game-3', title: 'Similar Game 2' },
      ] as Game[];

      repository.findById.mockResolvedValue(sourceGame);
      repository.findSimilar.mockResolvedValue(similarGames);

      const result = await service.findSimilarGames(gameId);

      expect(repository.findById).toHaveBeenCalledWith(gameId);
      expect(repository.findSimilar).toHaveBeenCalledWith(gameId, ['cat-1'], ['tag-1'], 5);
      expect(result).toEqual(similarGames);
    });

    it('should return an empty array if the source game is not found', async () => {
        const gameId = 'not-found';
        repository.findById.mockResolvedValue(null);

        const result = await service.findSimilarGames(gameId);

        expect(result).toEqual([]);
      });
  });
});
