import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PromotionService } from '../promotion.service';
import { Discount } from '../../../domain/entities/discount.entity';
import { Game } from '../../../domain/entities/game.entity';
import { GameRepository } from '../../../infrastructure/persistence/game.repository';
import { Repository } from 'typeorm';

const mockDiscountRepository = {
  find: jest.fn(),
  save: jest.fn(),
};

const mockGameRepository = {
  findById: jest.fn(),
  save: jest.fn(),
};

describe('PromotionService', () => {
  let service: PromotionService;
  let discountRepo: typeof mockDiscountRepository;
  let gameRepo: typeof mockGameRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionService,
        { provide: getRepositoryToken(Discount), useValue: mockDiscountRepository },
        { provide: GameRepository, useValue: mockGameRepository },
      ],
    }).compile();

    service = module.get<PromotionService>(PromotionService);
    discountRepo = module.get(getRepositoryToken(Discount));
    gameRepo = module.get(GameRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleDiscountUpdates', () => {
    it('should activate a pending discount and update the game price', async () => {
      const discount = { id: 'd1', gameId: 'g1', percentage: 20, isActive: false } as Discount;
      const game = { id: 'g1', price: 100 } as Game;

      discountRepo.find.mockResolvedValueOnce([discount]).mockResolvedValueOnce([]);
      gameRepo.findById.mockResolvedValue(game);

      await service.handleDiscountUpdates();

      expect(gameRepo.save).toHaveBeenCalledWith(expect.objectContaining({ price: 80 }));
      expect(discountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
    });

    it('should deactivate an expired discount and revert the game price', async () => {
        const discount = { id: 'd1', gameId: 'g1', percentage: 50, isActive: true } as Discount;
        const game = { id: 'g1', price: 50 } as Game;

        discountRepo.find.mockResolvedValueOnce([]).mockResolvedValueOnce([discount]);
        gameRepo.findById.mockResolvedValue(game);

        await service.handleDiscountUpdates();

        expect(gameRepo.save).toHaveBeenCalledWith(expect.objectContaining({ price: 100 }));
        expect(discountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
      });
  });
});
