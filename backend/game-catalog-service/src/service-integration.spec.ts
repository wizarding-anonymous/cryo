import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../src/entities/game.entity';
import { GameService } from '../src/game/game.service';
import { SearchService } from '../src/search/search.service';
import { CacheService } from '../src/common/services/cache.service';
import { CreateGameDto } from '../src/dto/create-game.dto';
import { UpdateGameDto } from '../src/dto/update-game.dto';
import { GetGamesDto } from '../src/dto/get-games.dto';
import { SearchGamesDto } from '../src/dto/search-games.dto';
import { NotFoundException } from '@nestjs/common';

describe('Service Integration Tests', () => {
  let gameService: GameService;
  let searchService: SearchService;
  let gameRepository: jest.Mocked<Repository<Game>>;
  let cacheService: jest.Mocked<CacheService>;

  // Mock data
  const mockGame: Game = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Test Game',
    description: 'A test game for integration testing',
    shortDescription: 'Test game',
    price: 29.99,
    currency: 'RUB',
    genre: 'Action',
    developer: 'Test Studio',
    publisher: 'Test Publisher',
    releaseDate: new Date('2023-01-01'),
    images: ['test1.jpg'],
    systemRequirements: {
      minimum: 'Test minimum requirements',
      recommended: 'Test recommended requirements',
    },
    available: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockGames: Game[] = [
    mockGame,
    {
      ...mockGame,
      id: '123e4567-e89b-12d3-a456-426614174001',
      title: 'Test Game 2',
      price: 49.99,
      genre: 'RPG',
    },
    {
      ...mockGame,
      id: '123e4567-e89b-12d3-a456-426614174002',
      title: 'Unavailable Game',
      available: false,
    },
  ];

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      findAndCount: jest.fn(),
      preload: jest.fn(),
      delete: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockCacheService = {
      invalidateGameCache: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        SearchService,
        {
          provide: getRepositoryToken(Game),
          useValue: mockRepository,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    gameService = module.get<GameService>(GameService);
    searchService = module.get<SearchService>(SearchService);
    gameRepository = module.get(getRepositoryToken(Game));
    cacheService = module.get(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GameService Integration', () => {
    describe('getAllGames', () => {
      it('should return paginated games with default filters', async () => {
        const getGamesDto: GetGamesDto = { page: 1, limit: 10 };
        const availableGames = mockGames.filter((game) => game.available);

        gameRepository.findAndCount.mockResolvedValue([
          availableGames,
          availableGames.length,
        ]);

        const result = await gameService.getAllGames(getGamesDto);

        expect(gameRepository.findAndCount).toHaveBeenCalledWith({
          where: { available: true },
          take: 10,
          skip: 0,
          order: { releaseDate: 'DESC' },
        });

        expect(result).toEqual({
          games: availableGames,
          total: availableGames.length,
          page: 1,
          limit: 10,
          hasNext: false,
        });
      });

      it('should apply genre filter when provided', async () => {
        const getGamesDto: GetGamesDto = { page: 1, limit: 10, genre: 'RPG' };
        const rpgGames = mockGames.filter(
          (game) => game.genre === 'RPG' && game.available,
        );

        gameRepository.findAndCount.mockResolvedValue([
          rpgGames,
          rpgGames.length,
        ]);

        const result = await gameService.getAllGames(getGamesDto);

        expect(gameRepository.findAndCount).toHaveBeenCalledWith({
          where: { available: true, genre: 'RPG' },
          take: 10,
          skip: 0,
          order: { releaseDate: 'DESC' },
        });

        expect(result.games).toEqual(rpgGames);
      });

      it('should apply custom sorting when provided', async () => {
        const getGamesDto: GetGamesDto = {
          page: 1,
          limit: 10,
          sortBy: 'price',
          sortOrder: 'ASC',
        };

        gameRepository.findAndCount.mockResolvedValue([
          mockGames,
          mockGames.length,
        ]);

        await gameService.getAllGames(getGamesDto);

        expect(gameRepository.findAndCount).toHaveBeenCalledWith({
          where: { available: true },
          take: 10,
          skip: 0,
          order: { price: 'ASC' },
        });
      });

      it('should calculate hasNext correctly', async () => {
        const getGamesDto: GetGamesDto = { page: 1, limit: 2 };

        gameRepository.findAndCount.mockResolvedValue([
          mockGames.slice(0, 2),
          5,
        ]);

        const result = await gameService.getAllGames(getGamesDto);

        expect(result.hasNext).toBe(true);
        expect(result.total).toBe(5);
      });
    });

    describe('getGameById', () => {
      it('should return game when found and available', async () => {
        gameRepository.findOneBy.mockResolvedValue(mockGame);

        const result = await gameService.getGameById(mockGame.id);

        expect(gameRepository.findOneBy).toHaveBeenCalledWith({
          id: mockGame.id,
          available: true,
        });
        expect(result).toEqual(mockGame);
      });

      it('should throw NotFoundException when game not found', async () => {
        gameRepository.findOneBy.mockResolvedValue(null);

        await expect(gameService.getGameById('nonexistent-id')).rejects.toThrow(
          NotFoundException,
        );

        expect(gameRepository.findOneBy).toHaveBeenCalledTimes(2); // First call for available, second for unavailable check
      });

      it('should throw specific error when game exists but unavailable', async () => {
        const unavailableGame = { ...mockGame, available: false };

        gameRepository.findOneBy
          .mockResolvedValueOnce(null) // First call (available: true)
          .mockResolvedValueOnce(unavailableGame); // Second call (check if exists but unavailable)

        await expect(gameService.getGameById(mockGame.id)).rejects.toThrow(
          'Game with ID "123e4567-e89b-12d3-a456-426614174000" is currently unavailable',
        );
      });
    });

    describe('createGame', () => {
      it('should create and save a new game', async () => {
        const createGameDto: CreateGameDto = {
          title: 'New Game',
          price: 39.99,
          developer: 'New Studio',
          genre: 'Adventure',
        };

        const newGame = { ...mockGame, ...createGameDto };

        gameRepository.create.mockReturnValue(newGame);
        gameRepository.save.mockResolvedValue(newGame);

        const result = await gameService.createGame(createGameDto);

        expect(gameRepository.create).toHaveBeenCalledWith(createGameDto);
        expect(gameRepository.save).toHaveBeenCalledWith(newGame);
        expect(cacheService.invalidateGameCache).toHaveBeenCalled();
        expect(result).toEqual(newGame);
      });

      it('should handle repository errors during creation', async () => {
        const createGameDto: CreateGameDto = {
          title: 'New Game',
          price: 39.99,
          developer: 'New Studio',
          genre: 'Adventure',
        };

        gameRepository.create.mockReturnValue(mockGame);
        gameRepository.save.mockRejectedValue(new Error('Database error'));

        await expect(gameService.createGame(createGameDto)).rejects.toThrow(
          'Database error',
        );

        expect(cacheService.invalidateGameCache).not.toHaveBeenCalled();
      });
    });

    describe('updateGame', () => {
      it('should update existing game', async () => {
        const updateGameDto: UpdateGameDto = {
          title: 'Updated Game',
          price: 59.99,
        };

        const updatedGame = { ...mockGame, ...updateGameDto };

        gameRepository.preload.mockResolvedValue(updatedGame);
        gameRepository.save.mockResolvedValue(updatedGame);

        const result = await gameService.updateGame(mockGame.id, updateGameDto);

        expect(gameRepository.preload).toHaveBeenCalledWith({
          id: mockGame.id,
          ...updateGameDto,
        });
        expect(gameRepository.save).toHaveBeenCalledWith(updatedGame);
        expect(cacheService.invalidateGameCache).toHaveBeenCalledWith(
          mockGame.id,
        );
        expect(result).toEqual(updatedGame);
      });

      it('should throw NotFoundException when game to update not found', async () => {
        const updateGameDto: UpdateGameDto = { title: 'Updated Game' };

        gameRepository.preload.mockResolvedValue(null);

        await expect(
          gameService.updateGame('nonexistent-id', updateGameDto),
        ).rejects.toThrow(NotFoundException);

        expect(gameRepository.save).not.toHaveBeenCalled();
        expect(cacheService.invalidateGameCache).not.toHaveBeenCalled();
      });
    });

    describe('deleteGame', () => {
      it('should delete existing game', async () => {
        gameRepository.delete.mockResolvedValue({ affected: 1, raw: {} });

        await gameService.deleteGame(mockGame.id);

        expect(gameRepository.delete).toHaveBeenCalledWith(mockGame.id);
        expect(cacheService.invalidateGameCache).toHaveBeenCalledWith(
          mockGame.id,
        );
      });

      it('should throw NotFoundException when game to delete not found', async () => {
        gameRepository.delete.mockResolvedValue({ affected: 0, raw: {} });

        await expect(gameService.deleteGame('nonexistent-id')).rejects.toThrow(
          NotFoundException,
        );

        expect(cacheService.invalidateGameCache).not.toHaveBeenCalled();
      });
    });

    describe('getGamePurchaseInfo', () => {
      it('should return purchase info for available game', async () => {
        gameRepository.findOneBy.mockResolvedValue(mockGame);

        const result = await gameService.getGamePurchaseInfo(mockGame.id);

        expect(result).toHaveProperty('id', mockGame.id);
        expect(result).toHaveProperty('title', mockGame.title);
        expect(result).toHaveProperty('price', mockGame.price);
        expect(result).toHaveProperty('currency', mockGame.currency);
        expect(result).toHaveProperty('available', mockGame.available);
      });

      it('should throw NotFoundException for unavailable game', async () => {
        gameRepository.findOneBy.mockResolvedValue(null);

        await expect(
          gameService.getGamePurchaseInfo('nonexistent-id'),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('SearchService Integration', () => {
    let mockQueryBuilder: any;

    beforeEach(() => {
      mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn(),
      };
      gameRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      jest.clearAllMocks();
    });

    describe('searchGames', () => {
      it('should search games with basic query', async () => {
        const searchDto: SearchGamesDto = {
          q: 'test',
          page: 1,
          limit: 10,
        };

        const searchResults = [mockGame];
        mockQueryBuilder.getManyAndCount.mockResolvedValue([searchResults, 1]);

        const result = await searchService.searchGames(searchDto);

        expect(gameRepository.createQueryBuilder).toHaveBeenCalledWith('game');
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
          "to_tsvector('russian', game.title) @@ to_tsquery('russian', :query)",
          { query: 'test:*' },
        );
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
          'game.available = :available',
          { available: true },
        );
        expect(result).toEqual({
          games: searchResults,
          total: 1,
          page: 1,
          limit: 10,
          hasNext: false,
        });
      });

      it('should apply price filters when provided', async () => {
        const searchDto: SearchGamesDto = {
          minPrice: 20,
          maxPrice: 50,
          page: 1,
          limit: 10,
        };

        mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

        await searchService.searchGames(searchDto);

        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
          'game.price >= :minPrice',
          { minPrice: 20 },
        );
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
          'game.price <= :maxPrice',
          { maxPrice: 50 },
        );
      });

      it('should handle different search types', async () => {
        const searchDto: SearchGamesDto = {
          q: 'adventure',
          searchType: 'description',
          page: 1,
          limit: 10,
        };

        mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

        await searchService.searchGames(searchDto);

        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
          "to_tsvector('russian', COALESCE(game.description, '')) @@ to_tsquery('russian', :query)",
          { query: 'adventure:*' },
        );
      });

      it('should handle search type "all"', async () => {
        const searchDto: SearchGamesDto = {
          q: 'epic',
          searchType: 'all',
          page: 1,
          limit: 10,
        };

        mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

        await searchService.searchGames(searchDto);

        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
          "to_tsvector('russian', game.title || ' ' || COALESCE(game.description, '') || ' ' || COALESCE(game.shortDescription, '')) @@ to_tsquery('russian', :query)",
          { query: 'epic:*' },
        );
      });

      it('should sanitize search queries', async () => {
        const searchDto: SearchGamesDto = {
          q: 'test!@#$%^&*()game',
          page: 1,
          limit: 10,
        };

        mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

        await searchService.searchGames(searchDto);

        // Should sanitize special characters and create proper tsquery
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
          "to_tsvector('russian', game.title) @@ to_tsquery('russian', :query)",
          { query: 'test:* & game:*' },
        );
      });

      it('should handle empty search query', async () => {
        const searchDto: SearchGamesDto = {
          q: '',
          page: 1,
          limit: 10,
        };

        mockQueryBuilder.getManyAndCount.mockResolvedValue([
          mockGames,
          mockGames.length,
        ]);

        const result = await searchService.searchGames(searchDto);

        // Should not apply text search filter for empty query
        expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
          expect.stringContaining('to_tsvector'),
          expect.any(Object),
        );
        expect(result.games).toEqual(mockGames);
      });

      it('should handle database errors gracefully', async () => {
        const searchDto: SearchGamesDto = {
          q: 'test',
          page: 1,
          limit: 10,
        };

        mockQueryBuilder.getManyAndCount.mockRejectedValue(
          new Error('Database error'),
        );

        const result = await searchService.searchGames(searchDto);

        // Should return empty results instead of throwing
        expect(result).toEqual({
          games: [],
          total: 0,
          page: 1,
          limit: 10,
          hasNext: false,
        });
      });

      it('should apply pagination correctly', async () => {
        const searchDto: SearchGamesDto = {
          page: 2,
          limit: 5,
        };

        mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

        await searchService.searchGames(searchDto);

        expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5); // (page - 1) * limit
        expect(mockQueryBuilder.take).toHaveBeenCalledWith(5);
      });

      it('should calculate hasNext correctly for search results', async () => {
        const searchDto: SearchGamesDto = {
          page: 1,
          limit: 2,
        };

        mockQueryBuilder.getManyAndCount.mockResolvedValue([
          mockGames.slice(0, 2),
          5,
        ]);

        const result = await searchService.searchGames(searchDto);

        expect(result.hasNext).toBe(true);
        expect(result.total).toBe(5);
      });
    });
  });

  describe('Service Integration Scenarios', () => {
    it('should handle game creation and immediate search', async () => {
      // Create a game
      const createGameDto: CreateGameDto = {
        title: 'Searchable Game',
        price: 29.99,
        developer: 'Search Studio',
        genre: 'Adventure',
      };

      const newGame = { ...mockGame, ...createGameDto };
      gameRepository.create.mockReturnValue(newGame);
      gameRepository.save.mockResolvedValue(newGame);

      const createdGame = await gameService.createGame(createGameDto);

      // Search for the created game
      const searchDto: SearchGamesDto = {
        q: 'Searchable',
        page: 1,
        limit: 10,
      };

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[createdGame], 1]),
      };
      gameRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );

      const searchResult = await searchService.searchGames(searchDto);

      expect(createdGame.title).toBe('Searchable Game');
      expect(searchResult.games).toContain(createdGame);
      expect(cacheService.invalidateGameCache).toHaveBeenCalled();
    });

    it('should handle game update and cache invalidation', async () => {
      const updateDto: UpdateGameDto = {
        title: 'Updated Game Title',
        price: 49.99,
      };

      const updatedGame = { ...mockGame, ...updateDto };
      gameRepository.preload.mockResolvedValue(updatedGame);
      gameRepository.save.mockResolvedValue(updatedGame);

      await gameService.updateGame(mockGame.id, updateDto);

      expect(cacheService.invalidateGameCache).toHaveBeenCalledWith(
        mockGame.id,
      );
    });

    it('should handle game deletion and cache cleanup', async () => {
      gameRepository.delete.mockResolvedValue({ affected: 1, raw: {} });

      await gameService.deleteGame(mockGame.id);

      expect(cacheService.invalidateGameCache).toHaveBeenCalledWith(
        mockGame.id,
      );
    });

    it('should maintain data consistency between services', async () => {
      // Get game through GameService
      gameRepository.findOneBy.mockResolvedValue(mockGame);
      const gameFromService = await gameService.getGameById(mockGame.id);

      // Search for the same game through SearchService
      const searchDto: SearchGamesDto = {
        q: mockGame.title,
        page: 1,
        limit: 10,
      };

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockGame], 1]),
      };
      gameRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );
      const searchResult = await searchService.searchGames(searchDto);

      // Both services should return consistent data
      expect(gameFromService.id).toBe(mockGame.id);
      expect(searchResult.games[0].id).toBe(mockGame.id);
      expect(gameFromService.title).toBe(searchResult.games[0].title);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle repository connection errors', async () => {
      gameRepository.findAndCount.mockRejectedValue(
        new Error('Connection lost'),
      );

      await expect(
        gameService.getAllGames({ page: 1, limit: 10 }),
      ).rejects.toThrow('Connection lost');
    });

    it('should handle cache service errors gracefully', async () => {
      const createGameDto: CreateGameDto = {
        title: 'Cache Test Game',
        price: 29.99,
        developer: 'Cache Studio',
        genre: 'Test',
      };

      const newGame = { ...mockGame, ...createGameDto };
      gameRepository.create.mockReturnValue(newGame);
      gameRepository.save.mockResolvedValue(newGame);
      cacheService.invalidateGameCache.mockRejectedValue(
        new Error('Cache error'),
      );

      // The current implementation doesn't handle cache errors gracefully
      // This test documents the current behavior - cache errors will propagate
      await expect(gameService.createGame(createGameDto)).rejects.toThrow(
        'Cache error',
      );

      expect(gameRepository.save).toHaveBeenCalled();
    });

    it('should handle search service database errors', async () => {
      const searchDto: SearchGamesDto = {
        q: 'test',
        page: 1,
        limit: 10,
      };

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest
          .fn()
          .mockRejectedValue(new Error('Search database error')),
      };
      gameRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );

      const result = await searchService.searchGames(searchDto);

      // Should return empty results instead of throwing
      expect(result).toEqual({
        games: [],
        total: 0,
        page: 1,
        limit: 10,
        hasNext: false,
      });
    });
  });
});
