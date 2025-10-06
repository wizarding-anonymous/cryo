/* eslint-disable @typescript-eslint/unbound-method */
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
    addOrderBy: jest.fn().mockReturnThis(),
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

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchGames', () => {
    beforeEach(() => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
    });

    it('should build a query with title search when "q" is provided', async () => {
      const searchGamesDto: SearchGamesDto = {
        q: 'test query',
        page: 1,
        limit: 10,
        searchType: 'title',
      };

      await service.searchGames(searchGamesDto);

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('game');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "to_tsvector('russian', game.title) @@ to_tsquery('russian', :query)",
        { query: 'test:* & query:*' },
      );
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should build a query with description search when searchType is "description"', async () => {
      const searchGamesDto: SearchGamesDto = {
        q: 'test query',
        page: 1,
        limit: 10,
        searchType: 'description',
      };

      await service.searchGames(searchGamesDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "to_tsvector('russian', COALESCE(game.description, '')) @@ to_tsquery('russian', :query)",
        { query: 'test:* & query:*' },
      );
    });

    it('should build a query with all fields search when searchType is "all"', async () => {
      const searchGamesDto: SearchGamesDto = {
        q: 'test query',
        page: 1,
        limit: 10,
        searchType: 'all',
      };

      await service.searchGames(searchGamesDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "to_tsvector('russian', game.title || ' ' || COALESCE(game.description, '') || ' ' || COALESCE(game.shortDescription, '') || ' ' || COALESCE(game.developer, '') || ' ' || COALESCE(game.publisher, '')) @@ to_tsquery('russian', :query)",
        { query: 'test:* & query:*' },
      );
    });

    it('should build a query without full-text search when "q" is not provided', async () => {
      const searchGamesDto: SearchGamesDto = { page: 2, limit: 5 };

      await service.searchGames(searchGamesDto);

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('game');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'game.available = :available',
        { available: true },
      );
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(5);
    });

    it('should apply price filters when provided', async () => {
      const searchGamesDto: SearchGamesDto = {
        page: 1,
        limit: 10,
        minPrice: 100,
        maxPrice: 500,
      };

      await service.searchGames(searchGamesDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'game.price >= :minPrice',
        { minPrice: 100 },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'game.price <= :maxPrice',
        { maxPrice: 500 },
      );
    });

    it('should return a paginated response', async () => {
      const mockGames = [new Game()];
      const mockTotal = 1;
      const searchGamesDto: SearchGamesDto = { page: 1, limit: 10 };
      mockQueryBuilder.getManyAndCount.mockResolvedValue([
        mockGames,
        mockTotal,
      ]);

      const result = await service.searchGames(searchGamesDto);

      expect(result.games).toEqual(mockGames);
      expect(result.total).toEqual(mockTotal);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.hasNext).toBe(false);
    });

    it('should calculate hasNext correctly when there are more results', async () => {
      const mockGames = Array(10).fill(new Game());
      const mockTotal = 25;
      const searchGamesDto: SearchGamesDto = { page: 2, limit: 10 };
      mockQueryBuilder.getManyAndCount.mockResolvedValue([
        mockGames,
        mockTotal,
      ]);

      const result = await service.searchGames(searchGamesDto);

      expect(result.hasNext).toBe(true);
    });

    it('should handle empty search results', async () => {
      const searchGamesDto: SearchGamesDto = {
        q: 'nonexistent game',
        page: 1,
        limit: 10,
      };
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.searchGames(searchGamesDto);

      expect(result.games).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasNext).toBe(false);
    });

    it('should sanitize search query properly', async () => {
      const searchGamesDto: SearchGamesDto = {
        q: 'test@#$%^&*()query   with   spaces',
        page: 1,
        limit: 10,
        searchType: 'title',
      };

      await service.searchGames(searchGamesDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "to_tsvector('russian', game.title) @@ to_tsquery('russian', :query)",
        { query: 'test:* & query:* & with:* & spaces:*' },
      );
    });

    it('should handle database errors gracefully', async () => {
      const searchGamesDto: SearchGamesDto = {
        q: 'test query',
        page: 1,
        limit: 10,
      };
      mockQueryBuilder.getManyAndCount.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.searchGames(searchGamesDto);

      expect(result.games).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasNext).toBe(false);
    });

    it('should handle empty or whitespace-only search query', async () => {
      const searchGamesDto: SearchGamesDto = {
        q: '   ',
        page: 1,
        limit: 10,
      };

      await service.searchGames(searchGamesDto);

      // Should not apply full-text search for empty/whitespace query
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'game.available = :available',
        { available: true },
      );
      // Should not have called full-text search
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('to_tsvector'),
        expect.any(Object),
      );
    });

    it('should handle search query with only special characters', async () => {
      const searchGamesDto: SearchGamesDto = {
        q: '@#$%^&*()',
        page: 1,
        limit: 10,
        searchType: 'title',
      };

      await service.searchGames(searchGamesDto);

      // Should not apply full-text search when sanitized query is empty
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'game.available = :available',
        { available: true },
      );
      // Should not have called full-text search
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('to_tsvector'),
        expect.any(Object),
      );
    });

    it('should use default search type when invalid searchType is provided', async () => {
      const searchGamesDto: SearchGamesDto = {
        q: 'test query',
        page: 1,
        limit: 10,
        searchType: 'invalid' as unknown as 'title' | 'description' | 'all',
      };

      await service.searchGames(searchGamesDto);

      // Should default to title search
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "to_tsvector('russian', game.title) @@ to_tsquery('russian', :query)",
        { query: 'test:* & query:*' },
      );
    });

    it('should apply correct ordering', async () => {
      const searchGamesDto: SearchGamesDto = { page: 1, limit: 10 };

      await service.searchGames(searchGamesDto);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'game.releaseDate',
        'DESC',
      );
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
        'game.title',
        'ASC',
      );
    });
  });
});
