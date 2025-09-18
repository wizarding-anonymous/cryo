import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Review } from './entities/review.entity';
import { GameRating } from './entities/game-rating.entity';
import databaseConfig from './config/database.config';

describe('Database Integration (PostgreSQL)', () => {
  let module: TestingModule;
  let reviewRepository: Repository<Review>;
  let gameRatingRepository: Repository<GameRating>;

  beforeAll(async () => {
    // Этот тест запускается только если PostgreSQL доступен
    const testConfig = {
      type: 'postgres' as const,
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5433', 10),
      username: process.env.DATABASE_USERNAME || 'review_user',
      password: process.env.DATABASE_PASSWORD || 'review_password',
      database: process.env.DATABASE_NAME || 'review_db',
      entities: [Review, GameRating],
      synchronize: true, // Только для тестов
      dropSchema: true, // Очищаем схему перед тестами
    };

    try {
      module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            load: [databaseConfig],
          }),
          TypeOrmModule.forRoot(testConfig),
          TypeOrmModule.forFeature([Review, GameRating]),
        ],
      }).compile();

      reviewRepository = module.get<Repository<Review>>(getRepositoryToken(Review));
      gameRatingRepository = module.get<Repository<GameRating>>(getRepositoryToken(GameRating));
    } catch (error) {
      console.log('PostgreSQL не доступен, пропускаем интеграционные тесты');
      return;
    }
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  beforeEach(async () => {
    if (!reviewRepository || !gameRatingRepository) {
      return;
    }
    // Очищаем данные перед каждым тестом
    await reviewRepository.clear();
    await gameRatingRepository.clear();
  });

  describe('Review Entity Integration', () => {
    it('should create and save a review to PostgreSQL', async () => {
      if (!reviewRepository) {
        console.log('PostgreSQL недоступен, пропускаем тест');
        return;
      }

      const review = reviewRepository.create({
        userId: 'user-123',
        gameId: 'game-456',
        text: 'This is a great game! I really enjoyed playing it.',
        rating: 5,
      });

      const savedReview = await reviewRepository.save(review);

      expect(savedReview.id).toBeDefined();
      expect(savedReview.userId).toBe('user-123');
      expect(savedReview.gameId).toBe('game-456');
      expect(savedReview.text).toBe('This is a great game! I really enjoyed playing it.');
      expect(savedReview.rating).toBe(5);
      expect(savedReview.createdAt).toBeDefined();
      expect(savedReview.updatedAt).toBeDefined();
    });

    it('should enforce unique constraint on gameId and userId', async () => {
      if (!reviewRepository) {
        console.log('PostgreSQL недоступен, пропускаем тест');
        return;
      }

      const review1 = reviewRepository.create({
        userId: 'user-123',
        gameId: 'game-456',
        text: 'First review',
        rating: 4,
      });

      const review2 = reviewRepository.create({
        userId: 'user-123',
        gameId: 'game-456',
        text: 'Second review',
        rating: 5,
      });

      await reviewRepository.save(review1);

      // Это должно вызвать ошибку из-за уникального ограничения
      await expect(reviewRepository.save(review2)).rejects.toThrow();
    });
  });

  describe('GameRating Entity Integration', () => {
    it('should create and save a game rating to PostgreSQL', async () => {
      if (!gameRatingRepository) {
        console.log('PostgreSQL недоступен, пропускаем тест');
        return;
      }

      const gameRating = gameRatingRepository.create({
        gameId: 'game-789',
        averageRating: 4.5,
        totalReviews: 10,
      });

      const savedGameRating = await gameRatingRepository.save(gameRating);

      expect(savedGameRating.gameId).toBe('game-789');
      expect(parseFloat(savedGameRating.averageRating.toString())).toBe(4.5);
      expect(savedGameRating.totalReviews).toBe(10);
      expect(savedGameRating.updatedAt).toBeDefined();
    });
  });
});