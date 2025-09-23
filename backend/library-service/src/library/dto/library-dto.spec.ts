import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import {
  AddGameToLibraryDto,
  SearchLibraryDto,
  LibraryQueryDto,
} from './index';

describe('Library DTOs', () => {
  describe('AddGameToLibraryDto', () => {
    it('should validate valid add game data', async () => {
      const dto = plainToClass(AddGameToLibraryDto, {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        gameId: '123e4567-e89b-12d3-a456-426614174001',
        orderId: '123e4567-e89b-12d3-a456-426614174002',
        purchaseId: '123e4567-e89b-12d3-a456-426614174003',
        purchasePrice: 59.99,
        currency: 'RUB',
        purchaseDate: '2024-01-15T10:30:00Z',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid UUID', async () => {
      const dto = plainToClass(AddGameToLibraryDto, {
        userId: 'invalid-uuid',
        gameId: '123e4567-e89b-12d3-a456-426614174001',
        orderId: '123e4567-e89b-12d3-a456-426614174002',
        purchaseId: '123e4567-e89b-12d3-a456-426614174003',
        purchasePrice: 59.99,
        currency: 'RUB',
        purchaseDate: '2024-01-15T10:30:00Z',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('userId');
    });

    it('should reject negative price', async () => {
      const dto = plainToClass(AddGameToLibraryDto, {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        gameId: '123e4567-e89b-12d3-a456-426614174001',
        orderId: '123e4567-e89b-12d3-a456-426614174002',
        purchaseId: '123e4567-e89b-12d3-a456-426614174003',
        purchasePrice: -10,
        currency: 'RUB',
        purchaseDate: '2024-01-15T10:30:00Z',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('purchasePrice');
    });

    it('should reject invalid currency length', async () => {
      const dto = plainToClass(AddGameToLibraryDto, {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        gameId: '123e4567-e89b-12d3-a456-426614174001',
        orderId: '123e4567-e89b-12d3-a456-426614174002',
        purchaseId: '123e4567-e89b-12d3-a456-426614174003',
        purchasePrice: 59.99,
        currency: 'RUBLES',
        purchaseDate: '2024-01-15T10:30:00Z',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('currency');
    });
  });

  describe('SearchLibraryDto', () => {
    it('should validate valid search data', async () => {
      const dto = plainToClass(SearchLibraryDto, {
        query: 'cyberpunk',
        page: 1,
        limit: 20,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject empty query', async () => {
      const dto = plainToClass(SearchLibraryDto, {
        query: '',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('query');
    });

    it('should reject query too short', async () => {
      const dto = plainToClass(SearchLibraryDto, {
        query: 'a',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('query');
    });

    it('should reject query too long', async () => {
      const dto = plainToClass(SearchLibraryDto, {
        query: 'a'.repeat(101),
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('query');
    });
  });

  describe('LibraryQueryDto', () => {
    it('should validate valid library query', async () => {
      const dto = plainToClass(LibraryQueryDto, {
        page: 1,
        limit: 20,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
