import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { RatingController } from './rating.controller';
import { RatingService } from '../services/rating.service';

describe('RatingController', () => {
    let controller: RatingController;
    let ratingService: RatingService;

    const mockRatingService = {
        getGameRating: jest.fn(),
    };

    const mockCacheManager = {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [RatingController],
            providers: [
                {
                    provide: RatingService,
                    useValue: mockRatingService,
                },
                {
                    provide: CACHE_MANAGER,
                    useValue: mockCacheManager,
                },
            ],
        }).compile();

        controller = module.get<RatingController>(RatingController);
        ratingService = module.get<RatingService>(RatingService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getGameRating', () => {
        it('should get game rating', async () => {
            const gameId = 'game-123';
            const expectedResult = {
                gameId,
                averageRating: 4.2,
                totalReviews: 15,
                updatedAt: new Date(),
            };

            mockRatingService.getGameRating.mockResolvedValue(expectedResult);

            const result = await controller.getGameRating(gameId);

            expect(ratingService.getGameRating).toHaveBeenCalledWith(gameId);
            expect(result).toEqual(expectedResult);
        });

        it('should handle game with no reviews', async () => {
            const gameId = 'game-456';
            const expectedResult = {
                gameId,
                averageRating: 0,
                totalReviews: 0,
                message: 'No reviews found for this game',
            };

            mockRatingService.getGameRating.mockResolvedValue(expectedResult);

            const result = await controller.getGameRating(gameId);

            expect(ratingService.getGameRating).toHaveBeenCalledWith(gameId);
            expect(result).toEqual(expectedResult);
        });
    });
});