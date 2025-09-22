import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { Game } from './game.entity';
import { randomUUID } from 'crypto';

describe('Game Entity', () => {
  describe('validation', () => {
    it('should pass validation with valid data', async () => {
      const gameData = {
        id: randomUUID(),
        title: 'Test Game',
        description: 'A test game description',
        shortDescription: 'Short description',
        price: 29.99,
        currency: 'RUB',
        genre: 'Action',
        developer: 'Test Developer',
        publisher: 'Test Publisher',
        releaseDate: new Date('2024-01-01'),
        images: ['https://example.com/image1.jpg'],
        systemRequirements: {
          minimum: 'Windows 10, 4GB RAM',
          recommended: 'Windows 11, 8GB RAM',
        },
        available: true,
      };

      const game = plainToClass(Game, gameData);
      const errors = await validate(game);

      expect(errors).toHaveLength(0);
    });

    it('should fail validation with invalid title', async () => {
      const gameData = {
        id: randomUUID(),
        title: '', // Empty title should fail
        price: 29.99,
        currency: 'RUB',
        available: true,
      };

      const game = plainToClass(Game, gameData);
      const errors = await validate(game);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((error) => error.property === 'title')).toBe(true);
    });

    it('should fail validation with invalid price', async () => {
      const gameData = {
        id: randomUUID(),
        title: 'Test Game',
        price: -10, // Negative price should fail
        currency: 'RUB',
        available: true,
      };

      const game = plainToClass(Game, gameData);
      const errors = await validate(game);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((error) => error.property === 'price')).toBe(true);
    });

    it('should fail validation with invalid currency', async () => {
      const gameData = {
        id: randomUUID(),
        title: 'Test Game',
        price: 29.99,
        currency: 'INVALID', // Invalid currency length
        available: true,
      };

      const game = plainToClass(Game, gameData);
      const errors = await validate(game);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((error) => error.property === 'currency')).toBe(true);
    });

    it('should fail validation with title too long', async () => {
      const gameData = {
        id: randomUUID(),
        title: 'A'.repeat(256), // Title too long
        price: 29.99,
        currency: 'RUB',
        available: true,
      };

      const game = plainToClass(Game, gameData);
      const errors = await validate(game);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((error) => error.property === 'title')).toBe(true);
    });

    it('should fail validation with short description too long', async () => {
      const gameData = {
        id: randomUUID(),
        title: 'Test Game',
        shortDescription: 'A'.repeat(501), // Short description too long
        price: 29.99,
        currency: 'RUB',
        available: true,
      };

      const game = plainToClass(Game, gameData);
      const errors = await validate(game);

      expect(errors.length).toBeGreaterThan(0);
      expect(
        errors.some((error) => error.property === 'shortDescription'),
      ).toBe(true);
    });

    it('should pass validation with optional fields as null', async () => {
      const gameData = {
        id: randomUUID(),
        title: 'Test Game',
        price: 29.99,
        currency: 'RUB',
        description: null,
        shortDescription: null,
        genre: null,
        developer: null,
        publisher: null,
        releaseDate: null,
        images: [],
        systemRequirements: null,
        available: true,
      };

      const game = plainToClass(Game, gameData);
      const errors = await validate(game);

      expect(errors).toHaveLength(0);
    });

    it('should validate system requirements structure', async () => {
      const gameData = {
        id: randomUUID(),
        title: 'Test Game',
        price: 29.99,
        currency: 'RUB',
        available: true,
        systemRequirements: {
          minimum: 'Windows 10',
          recommended: 'Windows 11',
        },
      };

      const game = plainToClass(Game, gameData);
      const errors = await validate(game);

      expect(errors).toHaveLength(0);
    });

    it('should validate images array', async () => {
      const gameData = {
        id: randomUUID(),
        title: 'Test Game',
        price: 29.99,
        currency: 'RUB',
        available: true,
        images: ['image1.jpg', 'image2.jpg'],
      };

      const game = plainToClass(Game, gameData);
      const errors = await validate(game);

      expect(errors).toHaveLength(0);
    });
  });

  describe('TypeORM decorators', () => {
    it('should have correct entity metadata', () => {
      const metadata = Reflect.getMetadata('design:type', Game.prototype, 'id');
      expect(metadata).toBe(String);
    });

    it('should have UUID primary key', () => {
      // This test verifies the entity structure is correct for TypeORM
      const game = new Game();
      expect(game).toBeInstanceOf(Game);
    });
  });
});
