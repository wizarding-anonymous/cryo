import { Test, TestingModule } from '@nestjs/testing';
import { LocalizationService } from './localization.service';
import { GameTranslationRepository } from '../../infrastructure/persistence/game-translation.repository';
import { GameTranslation } from '../../domain/entities/game-translation.entity';
import { Game } from '../../domain/entities/game.entity';

describe('LocalizationService', () => {
  let service: LocalizationService;
  let translationRepository: GameTranslationRepository;

  const mockTranslationRepository = {
    findOne: jest.fn(),
    findForGames: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalizationService,
        {
          provide: GameTranslationRepository,
          useValue: mockTranslationRepository,
        },
      ],
    }).compile();

    service = module.get<LocalizationService>(LocalizationService);
    translationRepository = module.get<GameTranslationRepository>(GameTranslationRepository);
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
      expect(translationRepository.findForGames).toHaveBeenCalledWith(gameIds, 'en');
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
      expect(translationRepository.findForGames).toHaveBeenCalledWith(gameIds, 'en');
      expect(translationRepository.findForGames).toHaveBeenCalledWith(['g2', 'g3'], 'ru');
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
      expect(translationRepository.findOne).toHaveBeenCalledWith({ gameId, languageCode: 'en' });
    });

    it('should return the default language translation if the requested one does not exist', async () => {
      mockTranslationRepository.findOne
        .mockResolvedValueOnce(null) // for 'de'
        .mockResolvedValueOnce(ruTranslation); // for 'ru' (default)
      const result = await service.getTranslationWithFallback(gameId, 'de');
      expect(result).toEqual(ruTranslation);
      expect(translationRepository.findOne).toHaveBeenCalledWith({ gameId, languageCode: 'de' });
      expect(translationRepository.findOne).toHaveBeenCalledWith({ gameId, languageCode: 'ru' });
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
  });

  describe('getLanguageFromHeader', () => {
    it('should parse a complex header and return the best match', () => {
      expect(service.getLanguageFromHeader('fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5')).toBe('fr');
    });
  });
});
