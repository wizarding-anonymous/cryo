import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchService } from './search.service';
import { Game } from '../entities/game.entity';
import { SearchGamesDto } from '../dto/search-games.dto';

describe('SearchService', () => {
  let service: SearchService;
  let repository: Repository<Game>;

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: getRepositoryToken(Game),
          useValue: {
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    repository = module.get<Repository<Game>>(getRepositoryToken(Game));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchGames', () => {
    it('should build a query with full-text search when "q" is provided', async () => {
      const searchGamesDto: SearchGamesDto = { q: 'test query', page: 1, limit: 10 };
      (mockQueryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await service.searchGames(searchGamesDto);

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('game');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "to_tsvector('russian', game.title) @@ to_tsquery('russian', :query)",
        { query: 'test & query:*' },
      );
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should build a query without full-text search when "q" is not provided', async () => {
      const searchGamesDto: SearchGamesDto = { page: 2, limit: 5 };
      (mockQueryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await service.searchGames(searchGamesDto);

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('game');
      expect(mockQueryBuilder.where).not.toHaveBeenCalledWith(
        expect.stringContaining('to_tsvector'),
        expect.any(Object),
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('game.available = :available', { available: true });
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(5);
    });

    it('should return a paginated response', async () => {
      const mockGames = [new Game()];
      const mockTotal = 1;
      const searchGamesDto: SearchGamesDto = { page: 1, limit: 10 };
      (mockQueryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([mockGames, mockTotal]);

      const result = await service.searchGames(searchGamesDto);

      expect(result.games).toEqual(mockGames);
      expect(result.total).toEqual(mockTotal);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.hasNext).toBe(false);
    });
  });
});
