import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReviewService } from './review.service';
import { OwnershipService } from './ownership.service';
import { RatingService } from './rating.service';
import { AchievementService } from './achievement.service';
import { NotificationService } from './notification.service';
import { GameCatalogService } from './game-catalog.service';
import { Review } from '../entities/review.entity';
import { GameRating } from '../entities/game-rating.entity';
import { CreateReviewDto, UpdateReviewDto, PaginationDto } from '../dto';

describe('ReviewService', () => {
  let service: ReviewService;
  let reviewRepository: jest.Mocked<Repository<Review>>;
  let ownershipService: jest.Mocked<OwnershipService>;
  let ratingService: jest.Mocked<RatingService>;
  let achievementService: jest.Mocked<AchievementService>;
  let notificationService: jest.Mocked<NotificationService>;
  let gameCatalogService: jest.Mocked<GameCatalogService>;

  const mockReview: Review = {
    id: '1',
    userId: 'user1',
    gameId: 'game1',
    text: 'Great game!',
    rating: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockGameRating: GameRating = {
    gameId: 'game1',
    averageRating: 4.5,
    totalReviews: 2,
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      remove: jest.fn(),
    };

    const mockOwnershipService = {
      checkGameOwnership: jest.fn(),
    };

    const mockRatingService = {
      updateGameRating: jest.fn(),
    };

    const mockAchievementService = {
      notifyFirstReview: jest.fn(),
      checkUserFirstReview: jest.fn(),
    };

    const mockNotificationService = {
      notifyNewReview: jest.fn(),
      notifyReviewUpdate: jest.fn(),
    };

    const mockGameCatalogService = {
      updateGameRating: jest.fn(),
      getGameInfo: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        {
          provide: getRepositoryToken(Review),
          useValue: mockRepository,
        },
        {
          provide: OwnershipService,
          useValue: mockOwnershipService,
        },
        {
          provide: RatingService,
          useValue: mockRatingService,
        },
        {
          provide: AchievementService,
          useValue: mockAchievementService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: GameCatalogService,
          useValue: mockGameCatalogService,
        },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
    reviewRepository = module.get(getRepositoryToken(Review));
    ownershipService = module.get(OwnershipService);
    ratingService = module.get(RatingService);
    achievementService = module.get(AchievementService);
    notificationService = module.get(NotificationService);
    gameCatalogService = module.get(GameCatalogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createReview', () => {
    const createReviewDto: CreateReviewDto = {
      gameId: 'game1',
      text: 'Great game!',
      rating: 5,
    };

    it('should create a review successfully', async () => {
      ownershipService.checkGameOwnership.mockResolvedValue(true);
      reviewRepository.findOne.mockResolvedValue(null);
      reviewRepository.create.mockReturnValue(mockReview);
      reviewRepository.save.mockResolvedValue(mockReview);
      ratingService.updateGameRating.mockResolvedValue(mockGameRating);
      gameCatalogService.getGameInfo.mockResolvedValue({ exists: true, name: 'Test Game' });
      achievementService.checkUserFirstReview.mockResolvedValue(true);
      achievementService.notifyFirstReview.mockResolvedValue(true);
      notificationService.notifyNewReview.mockResolvedValue(true);
      gameCatalogService.updateGameRating.mockResolvedValue(true);

      const result = await service.createReview('user1', createReviewDto);

      expect(result).toEqual(mockReview);
      expect(ownershipService.checkGameOwnership).toHaveBeenCalledWith('user1', 'game1');
      expect(reviewRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user1', gameId: 'game1' },
      });
      expect(ratingService.updateGameRating).toHaveBeenCalledWith('game1');
    });

    it('should throw ForbiddenException if user does not own the game', async () => {
      ownershipService.checkGameOwnership.mockResolvedValue(false);

      await expect(service.createReview('user1', createReviewDto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if user already reviewed the game', async () => {
      ownershipService.checkGameOwnership.mockResolvedValue(true);
      reviewRepository.findOne.mockResolvedValue(mockReview);

      await expect(service.createReview('user1', createReviewDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('getGameReviews', () => {
    it('should return paginated game reviews', async () => {
      const paginationDto: PaginationDto = { page: 1, limit: 10 };
      const reviews = [mockReview];
      reviewRepository.findAndCount.mockResolvedValue([reviews, 1]);

      const result = await service.getGameReviews('game1', paginationDto);

      expect(result).toEqual({ reviews, total: 1 });
      expect(reviewRepository.findAndCount).toHaveBeenCalledWith({
        where: { gameId: 'game1' },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
    });
  });

  describe('updateReview', () => {
    const updateReviewDto: UpdateReviewDto = {
      text: 'Updated review',
      rating: 4,
    };

    it('should update a review successfully', async () => {
      reviewRepository.findOne.mockResolvedValue(mockReview);
      reviewRepository.save.mockResolvedValue({ ...mockReview, ...updateReviewDto });
      ratingService.updateGameRating.mockResolvedValue(mockGameRating);
      gameCatalogService.getGameInfo.mockResolvedValue({ exists: true, name: 'Test Game' });
      notificationService.notifyReviewUpdate.mockResolvedValue(true);
      gameCatalogService.updateGameRating.mockResolvedValue(true);

      const result = await service.updateReview('1', 'user1', updateReviewDto);

      expect(result).toEqual({ ...mockReview, ...updateReviewDto });
      expect(ratingService.updateGameRating).toHaveBeenCalledWith('game1');
    });

    it('should throw NotFoundException if review does not exist', async () => {
      reviewRepository.findOne.mockResolvedValue(null);

      await expect(service.updateReview('1', 'user1', updateReviewDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own the review', async () => {
      reviewRepository.findOne.mockResolvedValue({ ...mockReview, userId: 'user2' });

      await expect(service.updateReview('1', 'user1', updateReviewDto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteReview', () => {
    it('should delete a review successfully', async () => {
      reviewRepository.findOne.mockResolvedValue(mockReview);
      reviewRepository.remove.mockResolvedValue(mockReview);
      ratingService.updateGameRating.mockResolvedValue(mockGameRating);
      gameCatalogService.updateGameRating.mockResolvedValue(true);

      await service.deleteReview('1', 'user1');

      expect(reviewRepository.remove).toHaveBeenCalledWith(mockReview);
      expect(ratingService.updateGameRating).toHaveBeenCalledWith('game1');
    });

    it('should throw NotFoundException if review does not exist', async () => {
      reviewRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteReview('1', 'user1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own the review', async () => {
      reviewRepository.findOne.mockResolvedValue({ ...mockReview, userId: 'user2' });

      await expect(service.deleteReview('1', 'user1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getUserReviews', () => {
    it('should return paginated user reviews', async () => {
      const paginationDto: PaginationDto = { page: 1, limit: 10 };
      const reviews = [mockReview];
      reviewRepository.findAndCount.mockResolvedValue([reviews, 1]);

      const result = await service.getUserReviews('user1', paginationDto);

      expect(result).toEqual({ reviews, total: 1 });
      expect(reviewRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: 'user1' },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
    });
  });
});