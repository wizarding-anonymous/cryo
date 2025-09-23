import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { LibraryRepository } from './repositories/library.repository';
import { GameCatalogClient } from '../clients/game-catalog.client';
import { SearchLibraryDto } from './dto/request.dto';
import { LibraryGame } from './entities/library-game.entity';

interface MinimalGameDetails {
  id: string;
  title?: string;
  developer?: string;
  publisher?: string;
}

describe('SearchService', () => {
  let service: SearchService;
  let libraryRepository: LibraryRepository;
  let gameCatalogClient: GameCatalogClient;

  const mockLibraryRepository = {
    find: jest.fn(),
  };

  const mockGameCatalogClient = {
    getGamesByIds: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: LibraryRepository, useValue: mockLibraryRepository },
        { provide: GameCatalogClient, useValue: mockGameCatalogClient },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    libraryRepository = module.get<LibraryRepository>(LibraryRepository);
    gameCatalogClient = module.get<GameCatalogClient>(GameCatalogClient);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchUserLibrary', () => {
    it('should return games filtered by title', async () => {
      const libraryGames = [{ gameId: '1' }, { gameId: '2' }] as LibraryGame[];
      const gameDetails: MinimalGameDetails[] = [
        { id: '1', title: 'Action Game', developer: 'Dev A' },
        { id: '2', title: 'Another Game', developer: 'Dev B' },
      ];
      mockLibraryRepository.find.mockResolvedValue(libraryGames);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue(gameDetails);

      const searchDto = new SearchLibraryDto();
      searchDto.query = 'Action';

      const result = await service.searchUserLibrary('user1', searchDto);

      expect(result.games).toHaveLength(1);
      const firstGame = result.games[0];
      expect(firstGame.gameDetails).toBeDefined();
      expect(firstGame.gameDetails?.title).toBe('Action Game');
    });

    it('should return games filtered by developer', async () => {
      const libraryGames = [{ gameId: '1' }, { gameId: '2' }] as LibraryGame[];
      const gameDetails: MinimalGameDetails[] = [
        { id: '1', title: 'Action Game', developer: 'Dev A' },
        { id: '2', title: 'Another Game', developer: 'Super Dev' },
      ];
      mockLibraryRepository.find.mockResolvedValue(libraryGames);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue(gameDetails);

      const searchDto = new SearchLibraryDto();
      searchDto.query = 'Super';

      const result = await service.searchUserLibrary('user1', searchDto);

      expect(result.games).toHaveLength(1);
      const firstGame = result.games[0];
      expect(firstGame.gameDetails).toBeDefined();
      expect(firstGame.gameDetails?.developer).toBe('Super Dev');
    });

    it('should handle empty library', async () => {
      mockLibraryRepository.find.mockResolvedValue([]);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue([]);

      const searchDto = new SearchLibraryDto();
      searchDto.query = 'anything';

      const result = await service.searchUserLibrary('user1', searchDto);
      expect(result.games).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should handle case insensitive search', async () => {
      const libraryGames = [{ gameId: '1' }] as LibraryGame[];
      const gameDetails: MinimalGameDetails[] = [{ id: '1', title: 'Action Game', developer: 'Dev A' }];
      mockLibraryRepository.find.mockResolvedValue(libraryGames);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue(gameDetails);

      const searchDto = new SearchLibraryDto();
      searchDto.query = 'action';

      const result = await service.searchUserLibrary('user1', searchDto);
      expect(result.games).toHaveLength(1);
    });

    it('should return an empty array if no games match', async () => {
      const libraryGames = [{ gameId: '1' }] as LibraryGame[];
      const gameDetails: MinimalGameDetails[] = [{ id: '1', title: 'Action Game' }];
      mockLibraryRepository.find.mockResolvedValue(libraryGames);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue(gameDetails);

      const searchDto = new SearchLibraryDto();
      searchDto.query = 'Adventure';

      const result = await service.searchUserLibrary('user1', searchDto);
      expect(result.games).toHaveLength(0);
    });

    it('should match by tags', async () => {
      const libraryGames = [{ gameId: '1' }, { gameId: '2' }] as LibraryGame[];
      const gameDetails: MinimalGameDetails[] = [
        { id: '1', title: 'Action Game', developer: 'Dev A', publisher: 'Pub', tags: ['RPG', 'Open World'] as any },
        { id: '2', title: 'Strategy', developer: 'Dev B', publisher: 'Pub', tags: ['Card', 'Turn-Based'] as any },
      ] as any;
      mockLibraryRepository.find.mockResolvedValue(libraryGames);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue(gameDetails);

      const searchDto = new SearchLibraryDto();
      searchDto.query = 'open';

      const result = await service.searchUserLibrary('user1', searchDto);
      expect(result.games).toHaveLength(1);
      expect(result.games[0].gameDetails?.title).toBe('Action Game');
    });

    it('should fuzzy match close queries', async () => {
      const libraryGames = [{ gameId: '1' }] as LibraryGame[];
      const gameDetails: any[] = [
        { id: '1', title: 'Cyberpunk', developer: 'CDPR', publisher: 'XYZ', tags: ['RPG'] },
      ];
      mockLibraryRepository.find.mockResolvedValue(libraryGames);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue(gameDetails);

      const searchDto = new SearchLibraryDto();
      searchDto.query = 'cyberpun'; // missing last char

      const result = await service.searchUserLibrary('user1', searchDto);
      expect(result.games).toHaveLength(1);
    });
  });
});
