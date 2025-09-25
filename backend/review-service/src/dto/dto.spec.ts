import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { CreateReviewDto, UpdateReviewDto, PaginationDto } from './index';

describe('DTOs Validation', () => {
  describe('CreateReviewDto', () => {
    it('should pass validation with valid data', async () => {
      const dto = plainToClass(CreateReviewDto, {
        gameId: 'game-123',
        text: 'This is a great game with excellent gameplay and graphics.',
        rating: 5,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with short text', async () => {
      const dto = plainToClass(CreateReviewDto, {
        gameId: 'game-123',
        text: 'Short',
        rating: 5,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('text');
    });

    it('should fail validation with long text', async () => {
      const dto = plainToClass(CreateReviewDto, {
        gameId: 'game-123',
        text: 'a'.repeat(1001),
        rating: 5,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('text');
    });

    it('should fail validation with invalid rating', async () => {
      const dto = plainToClass(CreateReviewDto, {
        gameId: 'game-123',
        text: 'This is a valid review text with enough characters.',
        rating: 6,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('rating');
    });

    it('should fail validation with missing gameId', async () => {
      const dto = plainToClass(CreateReviewDto, {
        text: 'This is a valid review text with enough characters.',
        rating: 5,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('gameId');
    });
  });

  describe('UpdateReviewDto', () => {
    it('should pass validation with valid partial data', async () => {
      const dto = plainToClass(UpdateReviewDto, {
        text: 'Updated review text with sufficient length.',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with empty object', async () => {
      const dto = plainToClass(UpdateReviewDto, {});

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with invalid rating', async () => {
      const dto = plainToClass(UpdateReviewDto, {
        rating: 0,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('rating');
    });
  });

  describe('PaginationDto', () => {
    it('should pass validation with valid data', async () => {
      const dto = plainToClass(PaginationDto, {
        page: '2',
        limit: '20',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(20);
    });

    it('should use default values when not provided', async () => {
      const dto = plainToClass(PaginationDto, {});

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(10);
    });

    it('should fail validation with invalid page', async () => {
      const dto = plainToClass(PaginationDto, {
        page: '0',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('page');
    });

    it('should fail validation with limit too high', async () => {
      const dto = plainToClass(PaginationDto, {
        limit: '100',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('limit');
    });
  });
});