import { Test, TestingModule } from '@nestjs/testing';
import { LocalizationService } from './localization.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GameTranslation } from '../../domain/entities/game-translation.entity';
import { Repository } from 'typeorm';
import { Game } from '../../domain/entities/game.entity';

describe('LocalizationService', () => {
  let service: LocalizationService;
  let translationRepository: Repository<GameTranslation>;

  const mockTranslationRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalizationService,
        {
          provide: getRepositoryToken(GameTranslation),
          useValue: mockTranslationRepository,
        },
      ],
    }).compile();

    service = module.get<LocalizationService>(LocalizationService);
    translationRepository = module.get<Repository<GameTranslation>>(getRepositoryToken(GameTranslation));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTranslationsForGames', () => {
    it('should fetch translations for multiple games', async () => {
      const gameIds = ['g1', 'g2'];
      const translations = [{ gameId: 'g1', title: 'T1' }, { gameId: 'g2', title: 'T2' }] as GameTranslation[];
      mockTranslationRepository.findForGames.mockResolvedValue(translations);

      const result = await service.getTranslationsForGames(gameIds, 'en');

      expect(result.size).toBe(2);
      expect(result.get('g1').title).toBe('T1');
      expect(mockTranslationRepository.findForGames).toHaveBeenCalledWith(gameIds, 'en');
    });

    it('should fallback for games without a requested translation', async () => {
      const gameIds = ['g1', 'g2', 'g3'];
      const enTranslations = [{ gameId: 'g1', title: 'T1_EN' }] as GameTranslation[];
      const ruTranslations = [{ gameId: 'g2', title: 'T2_RU' }] as GameTranslation[];

      mockTranslationRepository.findForGames
        .mockResolvedValueOnce(enTranslations) // for 'en'
        .mockResolvedValueOnce(ruTranslations); // for 'ru'

      const result = await service.getTranslationsForGames(gameIds, 'en');

      expect(result.size).toBe(2);
      expect(result.get('g1').title).toBe('T1_EN');
      expect(result.get('g2').title).toBe('T2_RU');
      expect(result.has('g3')).toBe(false);
      expect(mockTranslationRepository.findForGames).toHaveBeenCalledWith(gameIds, 'en');
      expect(mockTranslationRepository.findForGames).toHaveBeenCalledWith(['g2', 'g3'], 'ru');
    });
  });

  describe('getTranslationWithFallback', () => {
    const gameId = 'test-game';
    const enTranslation = { languageCode: 'en', title: 'English Title' } as GameTranslation;
    const ruTranslation = { languageCode: 'ru', title: 'Russian Title' } as GameTranslation;

    it('should return the translation for the requested language if it exists', async () => {
      mockTranslationRepository.findOne.mockResolvedValue(enTranslation);
      const result = await service.getTranslationWithFallback(gameId, 'en');
      expect(result).toEqual(enTranslation);
      expect(translationRepository.findOne).toHaveBeenCalledWith({ where: { gameId, languageCode: 'en' } });
    });

    it('should return the default language translation if the requested one does not exist', async () => {
      mockTranslationRepository.findOne
        .mockResolvedValueOnce(null) // for 'de'
        .mockResolvedValueOnce(ruTranslation); // for 'ru' (default)
      const result = await service.getTranslationWithFallback(gameId, 'de');
      expect(result).toEqual(ruTranslation);
      expect(translationRepository.findOne).toHaveBeenCalledWith({ where: { gameId, languageCode: 'de' } });
      expect(translationRepository.findOne).toHaveBeenCalledWith({ where: { gameId, languageCode: 'ru' } });
    });

    it('should return null if no translation is found (including default)', async () => {
        mockTranslationRepository.findOne.mockResolvedValue(null);
        const result = await service.getTranslationWithFallback(gameId, 'fr');
        expect(result).toBeNull();
    });
  });

  describe('applyTranslation', () => {
    const baseGame = { id: '1', title: 'Base Title', description: 'Base Desc' } as Game;
    const translation = { title: 'Translated Title', description: 'Translated Desc' } as GameTranslation;

    it('should apply translation fields to the game object', () => {
      const localizedGame = service.applyTranslation(baseGame, translation);
      expect(localizedGame.title).toBe(translation.title);
      expect(localizedGame.description).toBe(translation.description);
    });

    it('should not mutate the original game object', () => {
        service.applyTranslation(baseGame, translation);
        expect(baseGame.title).toBe('Base Title');
    });

    it('should return the original game if translation is null', () => {
        const localizedGame = service.applyTranslation(baseGame, null);
        expect(localizedGame).toEqual(baseGame);
    });
  });

  describe('getLanguageFromHeader', () => {
    it('should parse a simple header', () => {
      expect(service.getLanguageFromHeader('en-US')).toBe('en');
    });

    it('should parse a complex header and return the best match', () => {
      expect(service.getLanguageFromHeader('fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5')).toBe('fr');
    });

    it('should return the default language if header is undefined', () => {
      expect(service.getLanguageFromHeader(undefined)).toBe('ru');
    });
  });
});
