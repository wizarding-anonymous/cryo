import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { LibraryQueryDto, SearchLibraryDto, AddGameToLibraryDto } from './request.dto';

describe('Request DTOs', () => {
  describe('LibraryQueryDto', () => {
    it('should pass validation with valid data', async () => {
      const dto = plainToClass(LibraryQueryDto, {
        page: 1,
        limit: 20,
        sortBy: 'purchaseDate',
        sortOrder: 'desc',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should use default values when not provided', async () => {
      const dto = plainToClass(LibraryQueryDto, {});

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
      expect(dto.sortBy).toBe('purchaseDate');
      expect(dto.sortOrder).toBe('desc');
    });

    it('should fail validation with invalid page', async () => {
      const dto = plainToClass(LibraryQueryDto, { page: 0 });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should fail validation with invalid limit', async () => {
      const dto = plainToClass(LibraryQueryDto, { limit: 101 });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('max');
    });
  });

  describe('SearchLibraryDto', () => {
    it('should pass validation with valid query', async () => {
      const dto = plainToClass(SearchLibraryDto, {
        query: 'test game',
        page: 1,
        limit: 20,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with empty query', async () => {
      const dto = plainToClass(SearchLibraryDto, { query: '' });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation with too short query', async () => {
      const dto = plainToClass(SearchLibraryDto, { query: 'a' });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('should fail validation with too long query', async () => {
      const dto = plainToClass(SearchLibraryDto, { query: 'a'.repeat(101) });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('maxLength');
    });
  });

  describe('AddGameToLibraryDto', () => {
    it('should pass validation with valid data', async () => {
      const dto = plainToClass(AddGameToLibraryDto, {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        gameId: '123e4567-e89b-12d3-a456-426614174001',
        orderId: '123e4567-e89b-12d3-a456-426614174002',
        purchaseId: '123e4567-e89b-12d3-a456-426614174003',
        purchasePrice: 29.99,
        currency: 'USD',
        purchaseDate: '2023-01-01T00:00:00.000Z',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with invalid UUID', async () => {
      const dto = plainToClass(AddGameToLibraryDto, {
        userId: 'invalid-uuid',
        gameId: '123e4567-e89b-12d3-a456-426614174001',
        orderId: '123e4567-e89b-12d3-a456-426614174002',
        purchaseId: '123e4567-e89b-12d3-a456-426614174003',
        purchasePrice: 29.99,
        currency: 'USD',
        purchaseDate: '2023-01-01T00:00:00.000Z',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isUuid');
    });

    it('should fail validation with negative price', async () => {
      const dto = plainToClass(AddGameToLibraryDto, {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        gameId: '123e4567-e89b-12d3-a456-426614174001',
        orderId: '123e4567-e89b-12d3-a456-426614174002',
        purchaseId: '123e4567-e89b-12d3-a456-426614174003',
        purchasePrice: -10,
        currency: 'USD',
        purchaseDate: '2023-01-01T00:00:00.000Z',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should fail validation with invalid currency', async () => {
      const dto = plainToClass(AddGameToLibraryDto, {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        gameId: '123e4567-e89b-12d3-a456-426614174001',
        orderId: '123e4567-e89b-12d3-a456-426614174002',
        purchaseId: '123e4567-e89b-12d3-a456-426614174003',
        purchasePrice: 29.99,
        currency: 'INVALID',
        purchaseDate: '2023-01-01T00:00:00.000Z',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isLength');
    });
  });
});