import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationService } from '../recommendation.service';
import { GameRepository } from '../../../infrastructure/persistence/game.repository';
import { UserPreferenceServiceIntegration } from '../../../infrastructure/integrations/user-preference.service';

const mockGameRepository = {
  findPopular: jest.fn(),
  findByTagsAndCategories: jest.fn(),
};

const mockUserPreferenceService = {
  getPreferences: jest.fn(),
};

describe('RecommendationService', () => {
  let service: RecommendationService;
  let gameRepo: typeof mockGameRepository;
  let preferenceService: typeof mockUserPreferenceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationService,
        { provide: GameRepository, useValue: mockGameRepository },
        { provide: UserPreferenceServiceIntegration, useValue: mockUserPreferenceService },
      ],
    }).compile();

    service = module.get<RecommendationService>(RecommendationService);
    gameRepo = module.get(GameRepository);
    preferenceService = module.get(UserPreferenceServiceIntegration);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getForYou', () => {
    it('should call findByTagsAndCategories when user has preferences', async () => {
      const prefs = { favoriteTags: ['t1'], favoriteCategories: ['c1'] };
      preferenceService.getPreferences.mockResolvedValue(prefs);

      await service.getForYou('user-1');

      expect(preferenceService.getPreferences).toHaveBeenCalledWith('user-1');
      expect(gameRepo.findByTagsAndCategories).toHaveBeenCalledWith(['c1'], ['t1'], 10);
      expect(gameRepo.findPopular).not.toHaveBeenCalled();
    });

    it('should call findPopular when user has no preferences', async () => {
      const prefs = { favoriteTags: [], favoriteCategories: [] };
      preferenceService.getPreferences.mockResolvedValue(prefs);

      await service.getForYou('user-2');

      expect(preferenceService.getPreferences).toHaveBeenCalledWith('user-2');
      expect(gameRepo.findPopular).toHaveBeenCalledWith(10);
      expect(gameRepo.findByTagsAndCategories).not.toHaveBeenCalled();
    });
  });
});
