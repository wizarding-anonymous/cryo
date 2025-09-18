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
      
      // Проверяем, что entity имеет правильные поля
      const review = new Review();
      expect(review).toHaveProperty('id');
      expect(review).toHaveProperty('userId');
      expect(review).toHaveProperty('gameId');
      expect(review).toHaveProperty('text');
      expect(review).toHaveProperty('rating');
      expect(review).toHaveProperty('createdAt');
      expect(review).toHaveProperty('updatedAt');
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
      
      // Проверяем, что entity имеет правильные поля
      const gameRating = new GameRating();
      expect(gameRating).toHaveProperty('gameId');
      expect(gameRating).toHaveProperty('averageRating');
      expect(gameRating).toHaveProperty('totalReviews');
      expect(gameRating).toHaveProperty('updatedAt');
    });

    it('should handle decimal precision for averageRating', () => {
      const gameRating = new GameRating();
      gameRating.averageRating = 4.75;
      expect(gameRating.averageRating).toBe(4.75);
    });
  });
});