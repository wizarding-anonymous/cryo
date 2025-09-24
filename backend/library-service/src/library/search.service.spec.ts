import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { LibraryRepository } from './repositories/library.repository';
import { GameCatalogClient } from '../clients/game-catalog.client';
import { CacheService } from '../cache/cache.service';
import { SearchLibraryDto } from './dto';
import { LibraryGame } from '../entities/library-game.entity';

interface MinimalGameDetails {
  id: string;
  title?: string;
  developer?: string;
  publisher?: string;
  tags?: string[];
  images?: string[];
  releaseDate?: Date;
}

describe('SearchService', () => {
  let service: SearchService;

  const mockLibraryRepository = {
    find: jest.fn(),
    fullTextSearchLibrary: jest.fn(),
  };

  const mockGameCatalogClient = {
    getGamesByIds: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn().mockResolvedValue([]),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn(),
    getOrSet: jest.fn().mockImplementation(async (_key, fetchFn) => {
      return await fetchFn();
    }),
    getCachedSearchResults: jest
      .fn()
      .mockImplementation(async (_userId, _cacheKey, fetchFn) => {
        return await fetchFn();
      }),
    recordUserCacheKey: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: LibraryRepository, useValue: mockLibraryRepository },
        { provide: GameCatalogClient, useValue: mockGameCatalogClient },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchUserLibrary', () => {
    it('should return games filtered by title with enhanced scoring', async () => {
      const libraryGames = [
        { gameId: '1', userId: 'user1' },
        { gameId: '2', userId: 'user1' },
      ] as LibraryGame[];

      const gameDetails: MinimalGameDetails[] = [
        {
          id: '1',
          title: 'Cyberpunk 2077',
          developer: 'CD Projekt RED',
          publisher: 'CD Projekt',
          tags: ['RPG', 'Open World'],
        },
        {
          id: '2',
          title: 'The Witcher 3',
          developer: 'CD Projekt RED',
          publisher: 'CD Projekt',
          tags: ['RPG', 'Fantasy'],
        },
      ];

      mockLibraryRepository.fullTextSearchLibrary.mockResolvedValue([[], 0]);
      mockLibraryRepository.find.mockResolvedValue(libraryGames);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue(gameDetails);

      const searchDto = new SearchLibraryDto();
      searchDto.query = 'Cyberpunk';

      const result = await service.searchUserLibrary('user1', searchDto);

      expect(result.games).toHaveLength(1);
      const firstGame = result.games[0];
      expect(firstGame.gameDetails).toBeDefined();
      expect(firstGame.gameDetails?.title).toBe('Cyberpunk 2077');
    });

    it('should search by tags', async () => {
      const libraryGames = [{ gameId: '1', userId: 'user1' }] as LibraryGame[];

      const gameDetails: any[] = [
        {
          id: '1',
          title: 'Fantasy Game',
          developer: 'Test Dev',
          publisher: 'Test Pub',
          tags: ['RPG'],
          images: [],
          releaseDate: new Date(),
        },
      ];

      mockLibraryRepository.fullTextSearchLibrary.mockResolvedValue([[], 0]);
      mockLibraryRepository.find.mockResolvedValue(libraryGames);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue(gameDetails);

      const searchDto = new SearchLibraryDto();
      searchDto.query = 'RPG';

      const result = await service.searchUserLibrary('user1', searchDto);

      expect(result.games).toHaveLength(1);
      expect(result.games[0].gameDetails?.title).toBe('Fantasy Game');
    });

    it('should handle fuzzy matching for typos', async () => {
      const libraryGames = [{ gameId: '1', userId: 'user1' }] as LibraryGame[];
      const gameDetails: MinimalGameDetails[] = [
        { id: '1', title: 'Cyberpunk 2077', developer: 'CD Projekt RED' },
      ];

      mockLibraryRepository.fullTextSearchLibrary.mockResolvedValue([[], 0]);
      mockLibraryRepository.find.mockResolvedValue(libraryGames);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue(gameDetails);

      const searchDto = new SearchLibraryDto();
      searchDto.query = 'cyberpun'; // missing last character

      const result = await service.searchUserLibrary('user1', searchDto);

      // Should still find the game due to fuzzy matching
      expect(result.games).toHaveLength(1);
      expect(result.games[0].gameDetails?.title).toBe('Cyberpunk 2077');
    });
  });

  describe('searchByField', () => {
    it('should search specifically by title field', async () => {
      const libraryGames = [
        { gameId: '1', userId: 'user1' },
        { gameId: '2', userId: 'user1' },
      ] as LibraryGame[];

      const gameDetails: MinimalGameDetails[] = [
        { id: '1', title: 'Cyberpunk 2077', developer: 'Other Dev' },
        { id: '2', title: 'Other Game', developer: 'Cyberpunk Studios' },
      ];

      mockLibraryRepository.find.mockResolvedValue(libraryGames);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue(gameDetails);

      const result = await service.searchByField('user1', 'title', 'Cyberpunk');

      expect(result.games).toHaveLength(1);
      expect(result.games[0].gameDetails?.title).toBe('Cyberpunk 2077');
    });

    it('should search specifically by tags field', async () => {
      const libraryGames = [
        { gameId: '1', userId: 'user1' },
        { gameId: '2', userId: 'user1' },
      ] as LibraryGame[];

      const gameDetails: MinimalGameDetails[] = [
        {
          id: '1',
          title: 'RPG Game',
          developer: 'Dev A',
          tags: ['RPG', 'Fantasy'],
        },
        {
          id: '2',
          title: 'Action Game',
          developer: 'Dev B',
          tags: ['Action', 'Shooter'],
        },
      ];

      mockLibraryRepository.find.mockResolvedValue(libraryGames);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue(gameDetails);

      const result = await service.searchByField('user1', 'tags', 'RPG');

      expect(result.games).toHaveLength(1);
      expect(result.games[0].gameDetails?.title).toBe('RPG Game');
    });
  });
});
