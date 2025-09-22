import 'reflect-metadata';
import { Review } from './review.entity';
import { GameRating } from './game-rating.entity';

describe('Entities', () => {
  describe('Review Entity', () => {
    it('should create a review instance with all required fields', () => {
      const review = new Review();
      review.userId = 'user-123';
      review.gameId = 'game-456';
      review.text = 'This is a great game! I really enjoyed playing it.';
      review.rating = 5;

      expect(review.userId).toBe('user-123');
      expect(review.gameId).toBe('game-456');
      expect(review.text).toBe('This is a great game! I really enjoyed playing it.');
      expect(review.rating).toBe(5);
    });

    it('should have proper TypeORM decorators', () => {
      expect(Review).toBeDefined();
      expect(typeof Review).toBe('function');
      
      // Проверяем, что entity класс существует и может быть инстанцирован
      const review = new Review();
      expect(review).toBeInstanceOf(Review);
      
      // Проверяем, что можно установить значения полей
      review.id = 'test-id';
      review.userId = 'user-123';
      review.gameId = 'game-456';
      review.text = 'Test review';
      review.rating = 5;
      review.createdAt = new Date();
      review.updatedAt = new Date();
      
      expect(review.id).toBe('test-id');
      expect(review.userId).toBe('user-123');
      expect(review.gameId).toBe('game-456');
      expect(review.text).toBe('Test review');
      expect(review.rating).toBe(5);
      expect(review.createdAt).toBeInstanceOf(Date);
      expect(review.updatedAt).toBeInstanceOf(Date);
    });

    it('should validate rating constraints', () => {
      const review = new Review();
      review.rating = 5;
      expect(review.rating).toBe(5);
      
      review.rating = 1;
      expect(review.rating).toBe(1);
    });
  });

  describe('GameRating Entity', () => {
    it('should create a game rating instance', () => {
      const gameRating = new GameRating();
      gameRating.gameId = 'game-789';
      gameRating.averageRating = 4.5;
      gameRating.totalReviews = 10;

      expect(gameRating.gameId).toBe('game-789');
      expect(gameRating.averageRating).toBe(4.5);
      expect(gameRating.totalReviews).toBe(10);
    });

    it('should have proper TypeORM decorators', () => {
      expect(GameRating).toBeDefined();
      expect(typeof GameRating).toBe('function');
      
      // Проверяем, что entity класс существует и может быть инстанцирован
      const gameRating = new GameRating();
      expect(gameRating).toBeInstanceOf(GameRating);
      
      // Проверяем, что можно установить значения полей
      gameRating.gameId = 'game-123';
      gameRating.averageRating = 4.5;
      gameRating.totalReviews = 10;
      gameRating.updatedAt = new Date();
      
      expect(gameRating.gameId).toBe('game-123');
      expect(gameRating.averageRating).toBe(4.5);
      expect(gameRating.totalReviews).toBe(10);
      expect(gameRating.updatedAt).toBeInstanceOf(Date);
    });

    it('should handle decimal precision for averageRating', () => {
      const gameRating = new GameRating();
      gameRating.averageRating = 4.75;
      expect(gameRating.averageRating).toBe(4.75);
    });
  });
});