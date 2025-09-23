import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { PaginationDto, BaseQueryDto } from './index';
import { SortBy, SortOrder } from '../enums';

describe('Common DTOs', () => {
  describe('PaginationDto', () => {
    it('should validate valid pagination data', async () => {
      const dto = plainToClass(PaginationDto, {
        page: 1,
        limit: 20,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should use default values when not provided', async () => {
      const dto = plainToClass(PaginationDto, {});

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
    });

    it('should reject invalid page number', async () => {
      const dto = plainToClass(PaginationDto, {
        page: 0,
        limit: 20,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('page');
    });

    it('should reject limit exceeding maximum', async () => {
      const dto = plainToClass(PaginationDto, {
        page: 1,
        limit: 101,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('limit');
    });
  });

  describe('BaseQueryDto', () => {
    it('should validate valid query data', async () => {
      const dto = plainToClass(BaseQueryDto, {
        page: 1,
        limit: 20,
        sortBy: SortBy.PURCHASE_DATE,
        sortOrder: SortOrder.DESC,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should use default sort values', async () => {
      const dto = plainToClass(BaseQueryDto, {});

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.sortBy).toBe(SortBy.PURCHASE_DATE);
      expect(dto.sortOrder).toBe(SortOrder.DESC);
    });

    it('should reject invalid sort field', async () => {
      const dto = plainToClass(BaseQueryDto, {
        sortBy: 'invalid_field',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('sortBy');
    });
  });
});
