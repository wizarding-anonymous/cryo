import { Test, TestingModule } from '@nestjs/testing';
import { GameService } from '../game.service';
import { GameRepository } from '../../../infrastructure/persistence/game.repository';
import { CategoryRepository } from '../../../infrastructure/persistence/category.repository';
import { TagRepository } from '../../../infrastructure/persistence/tag.repository';
import { SearchService } from '../search.service';
import { AnalyticsService } from '../analytics.service';
import { EventPublisherService } from '../event-publisher.service';
import { LocalizationService } from '../localization.service';
import { CreateGameDto } from '../../../infrastructure/http/dtos/create-game.dto';
import { Game, GameStatus } from '../../../domain/entities/game.entity';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

const mockGameRepository = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  findByDeveloper: jest.fn(),
  findByStatus: jest.fn(),
};

const mockCategoryRepository = {
  findByIds: jest.fn(),
};

const mockTagRepository = {
  findByIds: jest.fn(),
};

const mockSearchService = {
  indexGame: jest.fn(),
  removeGame: jest.fn(),
};

const mockAnalyticsService = {
  trackGameView: jest.fn(),
};

const mockEventPublisher = {
  publish: jest.fn(),
};

const mockLocalizationService = {
    getLanguageFromHeader: jest.fn(),
    getTranslationWithFallback: jest.fn(),
    applyTranslation: jest.fn((game, translation) => (translation ? { ...game, title: translation.title } : game)),
};

const mockCacheManager = {
  store: {
    keys: jest.fn(),
    del: jest.fn(),
  },
};

describe('GameService', () => {
  let service: GameService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        { provide: GameRepository, useValue: mockGameRepository },
        { provide: CategoryRepository, useValue: mockCategoryRepository },
        { provide: TagRepository, useValue: mockTagRepository },
        { provide: SearchService, useValue: mockSearchService },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
        { provide: EventPublisherService, useValue: mockEventPublisher },
        { provide: LocalizationService, useValue: mockLocalizationService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<GameService>(GameService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a game with unique slug and relations', async () => {
      const dto: CreateGameDto = { title: 'New Game', price: 10, developerId: 'dev1', isFree: false, categoryIds: ['cat1'], tagIds: ['tag1'] };
      const game = { ...new Game(), ...dto };

      mockGameRepository.findBySlug.mockResolvedValue(null); // Slug is unique
      mockCategoryRepository.findByIds.mockResolvedValue([{ id: 'cat1', name: 'Action' }]);
      mockTagRepository.findByIds.mockResolvedValue([{ id: 'tag1', name: 'Indie' }]);
      mockGameRepository.create.mockResolvedValue(game);

      await service.create(dto, 'dev1');

      expect(mockGameRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        slug: 'new-game',
        categories: expect.any(Array),
        tags: expect.any(Array),
      }));
      expect(mockSearchService.indexGame).toHaveBeenCalled();
      expect(mockCacheManager.store.keys).toHaveBeenCalled();
    });

    it('should generate a unique slug if the initial slug exists', async () => {
        const dto: CreateGameDto = { title: 'Existing Game', price: 10, developerId: 'dev1', isFree: false };

        mockGameRepository.findBySlug.mockResolvedValueOnce({ id: '1', title: 'Existing Game', slug: 'existing-game' }); // First slug exists
        mockGameRepository.findBySlug.mockResolvedValueOnce(null); // Second slug is unique
        mockGameRepository.create.mockResolvedValue({} as Game);

        await service.create(dto, 'dev1');

        expect(mockGameRepository.create).toHaveBeenCalledWith(expect.objectContaining({
          slug: 'existing-game-1',
        }));
      });
  });

  describe('update', () => {
    it('should update a game', async () => {
        const gameId = 'game1';
        const devId = 'dev1';
        const existingGame = { id: gameId, developerId: devId, title: 'Old Title' } as Game;
        const updateDto = { title: 'New Title' };

        mockGameRepository.findById.mockResolvedValue(existingGame);
        mockGameRepository.save.mockResolvedValue({ ...existingGame, ...updateDto });

        await service.update(gameId, updateDto, devId);

        expect(mockGameRepository.save).toHaveBeenCalled();
        expect(mockSearchService.indexGame).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if developer is not the owner', async () => {
        const gameId = 'game1';
        const devId = 'dev1';
        const otherDevId = 'dev2';
        const existingGame = { id: gameId, developerId: otherDevId } as Game;

        mockGameRepository.findById.mockResolvedValue(existingGame);

        await expect(service.update(gameId, {}, devId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should remove a game', async () => {
        const gameId = 'game1';
        const devId = 'dev1';
        const existingGame = { id: gameId, developerId: devId } as Game;

        mockGameRepository.findById.mockResolvedValue(existingGame);

        await service.remove(gameId, devId);

        expect(mockGameRepository.remove).toHaveBeenCalledWith(existingGame);
        expect(mockSearchService.removeGame).toHaveBeenCalledWith(gameId);
    });

    it('should throw ForbiddenException if developer does not own the game on remove', async () => {
        const gameId = 'game1';
        const devId = 'dev1';
        const otherDevId = 'dev2';
        const existingGame = { id: gameId, developerId: otherDevId } as Game;

        mockGameRepository.findById.mockResolvedValue(existingGame);

        await expect(service.remove(gameId, devId)).rejects.toThrow(ForbiddenException);
    });
  });


  describe('findOne', () => {
    it('should return a game without translation if no language header is provided', async () => {
      const game = { id: 'game1', title: 'Original Title' } as Game;
      mockGameRepository.findById.mockResolvedValue(game);

      const result = await service.findOne('game1');

      expect(result.title).toBe('Original Title');
      expect(mockLocalizationService.getLanguageFromHeader).not.toHaveBeenCalled();
    });

    it('should return a translated game if language header is provided and translation exists', async () => {
        const game = { id: 'game1', title: 'Original Title' } as Game;
        const translation = { title: 'Translated Title' };
        mockGameRepository.findById.mockResolvedValue(game);
        mockLocalizationService.getLanguageFromHeader.mockReturnValue('de');
        mockLocalizationService.getTranslationWithFallback.mockResolvedValue(translation);

        const result = await service.findOne('game1', 'de-DE');

        expect(result.title).toBe('Translated Title');
        expect(mockLocalizationService.getLanguageFromHeader).toHaveBeenCalledWith('de-DE');
        expect(mockLocalizationService.getTranslationWithFallback).toHaveBeenCalledWith('game1', 'de');
        expect(mockLocalizationService.applyTranslation).toHaveBeenCalledWith(game, translation);
      });

      it('should return the original game if translation does not exist', async () => {
        const game = { id: 'game1', title: 'Original Title' } as Game;
        mockGameRepository.findById.mockResolvedValue(game);
        mockLocalizationService.getLanguageFromHeader.mockReturnValue('fr');
        mockLocalizationService.getTranslationWithFallback.mockResolvedValue(null);

        const result = await service.findOne('game1', 'fr-FR');

        expect(result.title).toBe('Original Title');
      });
  });

  describe('findAll', () => {
    it('should return a list of translated games', async () => {
        const games = [{ id: 'g1', title: 'Game 1' }, { id: 'g2', title: 'Game 2' }];
        const translations = new Map([
            ['g1', { title: 'Translated Game 1' }],
            ['g2', { title: 'Translated Game 2' }],
        ]);
        mockGameRepository.findAll.mockResolvedValue({ data: games, total: 2 });
        mockLocalizationService.getLanguageFromHeader.mockReturnValue('de');
        mockLocalizationService.getTranslationsForGames.mockResolvedValue(translations);

        const result = await service.findAll({ page: 1, limit: 10 }, 'de-DE');

        expect(result.data[0].title).toBe('Translated Game 1');
        expect(result.data[1].title).toBe('Translated Game 2');
        expect(mockLocalizationService.getTranslationsForGames).toHaveBeenCalledWith(['g1', 'g2'], 'de');
    });

    it('should return untranslated list if no header is provided', async () => {
        const games = [{ id: 'g1', title: 'Game 1' }];
        mockGameRepository.findAll.mockResolvedValue({ data: games, total: 1 });

        const result = await service.findAll({ page: 1, limit: 10 });

        expect(result.data[0].title).toBe('Game 1');
        expect(mockLocalizationService.getTranslationsForGames).not.toHaveBeenCalled();
    });
  });
});
