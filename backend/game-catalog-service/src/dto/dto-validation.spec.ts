import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { GetGamesDto } from './get-games.dto';
import { SearchGamesDto } from './search-games.dto';
import { GameResponseDto } from './game-response.dto';
import { GameListResponseDto } from './game-list-response.dto';
import { CreateGameDto } from './create-game.dto';
import { UpdateGameDto } from './update-game.dto';
import { PurchaseInfoDto } from './purchase-info.dto';
import { Game } from '../entities/game.entity';

describe('DTO Validation Tests', () => {
  describe('GetGamesDto', () => {
    it('should validate with default values', async () => {
      const dto = plainToClass(GetGamesDto, {});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(10);
    });

    it('should validate with valid parameters', async () => {
      const dto = plainToClass(GetGamesDto, {
        page: 2,
        limit: 20,
        sortBy: 'title',
        sortOrder: 'ASC',
        genre: 'Action',
        available: true,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with invalid page', async () => {
      const dto = plainToClass(GetGamesDto, { page: 0 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('page');
    });

    it('should fail validation with invalid limit', async () => {
      const dto = plainToClass(GetGamesDto, { limit: 101 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('limit');
    });

    it('should fail validation with invalid sortBy', async () => {
      const dto = plainToClass(GetGamesDto, { sortBy: 'invalid' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('sortBy');
    });

    it('should transform sortOrder to uppercase', () => {
      const dto = plainToClass(GetGamesDto, { sortOrder: 'asc' });
      expect(dto.sortOrder).toBe('ASC');
    });
  });

  describe('SearchGamesDto', () => {
    it('should validate with valid search query', async () => {
      const dto = plainToClass(SearchGamesDto, {
        q: 'cyberpunk',
        searchType: 'title',
        minPrice: 100,
        maxPrice: 5000,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with empty search query', async () => {
      const dto = plainToClass(SearchGamesDto, { q: '' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('q');
    });

    it('should fail validation with too long search query', async () => {
      const dto = plainToClass(SearchGamesDto, { q: 'a'.repeat(256) });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('q');
    });

    it('should trim search query', () => {
      const dto = plainToClass(SearchGamesDto, { q: '  cyberpunk  ' });
      expect(dto.q).toBe('cyberpunk');
    });

    it('should inherit GetGamesDto validation', async () => {
      const dto = plainToClass(SearchGamesDto, { page: 0 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('page');
    });
  });

  describe('CreateGameDto', () => {
    it('should validate with valid game data', async () => {
      const dto = plainToClass(CreateGameDto, {
        title: 'Test Game',
        description: 'A test game',
        shortDescription: 'Test',
        price: 59.99,
        currency: 'USD',
        genre: 'Action',
        developer: 'Test Studio',
        publisher: 'Test Publisher',
        releaseDate: '2023-01-01',
        images: ['/img/test1.jpg', '/img/test2.jpg'],
        systemRequirements: {
          minimum: 'Windows 10, 4GB RAM',
          recommended: 'Windows 11, 8GB RAM',
        },
        available: true,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation without title', async () => {
      const dto = plainToClass(CreateGameDto, { price: 59.99 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((error) => error.property === 'title')).toBe(true);
    });

    it('should fail validation with negative price', async () => {
      const dto = plainToClass(CreateGameDto, {
        title: 'Test Game',
        price: -10,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((error) => error.property === 'price')).toBe(true);
    });

    it('should fail validation with invalid currency length', async () => {
      const dto = plainToClass(CreateGameDto, {
        title: 'Test Game',
        price: 59.99,
        currency: 'INVALID',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((error) => error.property === 'currency')).toBe(true);
    });

    it('should use default currency RUB', () => {
      const dto = plainToClass(CreateGameDto, {
        title: 'Test Game',
        price: 59.99,
      });
      expect(dto.currency).toBe('RUB');
    });
  });

  describe('GameResponseDto', () => {
    it('should create response DTO from Game entity', () => {
      const mockGame = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Game',
        description: 'A test game',
        shortDescription: 'Test',
        price: 59.99,
        currency: 'USD',
        genre: 'Action',
        developer: 'Test Studio',
        publisher: 'Test Publisher',
        releaseDate: new Date('2023-01-01'),
        images: ['/img/test1.jpg'],
        systemRequirements: {
          minimum: 'Windows 10, 4GB RAM',
          recommended: 'Windows 11, 8GB RAM',
        },
        available: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      } as Game;

      const dto = new GameResponseDto(mockGame);
      expect(dto.id).toBe(mockGame.id);
      expect(dto.title).toBe(mockGame.title);
      expect(dto.price).toBe(mockGame.price);
      expect(dto.available).toBe(mockGame.available);
    });
  });

  describe('GameListResponseDto', () => {
    it('should create list response with pagination', () => {
      const mockGames = [
        new GameResponseDto({
          id: '1',
          title: 'Game 1',
          price: 29.99,
        } as Game),
        new GameResponseDto({
          id: '2',
          title: 'Game 2',
          price: 39.99,
        } as Game),
      ];

      const dto = new GameListResponseDto(mockGames, 50, 2, 10);
      expect(dto.games).toHaveLength(2);
      expect(dto.total).toBe(50);
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(10);
      expect(dto.totalPages).toBe(5);
      expect(dto.hasNext).toBe(true);
      expect(dto.hasPrevious).toBe(true);
    });

    it('should calculate pagination correctly for first page', () => {
      const dto = new GameListResponseDto([], 25, 1, 10);
      expect(dto.totalPages).toBe(3);
      expect(dto.hasNext).toBe(true);
      expect(dto.hasPrevious).toBe(false);
    });

    it('should calculate pagination correctly for last page', () => {
      const dto = new GameListResponseDto([], 25, 3, 10);
      expect(dto.totalPages).toBe(3);
      expect(dto.hasNext).toBe(false);
      expect(dto.hasPrevious).toBe(true);
    });
  });

  describe('PurchaseInfoDto', () => {
    it('should create purchase info from Game entity', () => {
      const mockGame = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Game',
        price: 59.99,
        currency: 'USD',
        available: true,
      } as Game;

      const dto = new PurchaseInfoDto(mockGame);
      expect(dto.id).toBe(mockGame.id);
      expect(dto.title).toBe(mockGame.title);
      expect(dto.price).toBe(59.99);
      expect(dto.currency).toBe(mockGame.currency);
      expect(dto.available).toBe(mockGame.available);
    });

    it('should cast price to number', () => {
      const mockGame = {
        id: '123',
        title: 'Test Game',
        price: '59.99' as unknown as number, // Simulate string price from database
        currency: 'USD',
        available: true,
      } as Game;

      const dto = new PurchaseInfoDto(mockGame);
      expect(typeof dto.price).toBe('number');
      expect(dto.price).toBe(59.99);
    });
  });

  describe('UpdateGameDto', () => {
    it('should validate partial updates', async () => {
      const dto = plainToClass(UpdateGameDto, {
        title: 'Updated Game Title',
        price: 49.99,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate empty update', async () => {
      const dto = plainToClass(UpdateGameDto, {});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with invalid data', async () => {
      const dto = plainToClass(UpdateGameDto, {
        price: -10,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((error) => error.property === 'price')).toBe(true);
    });
  });
});
