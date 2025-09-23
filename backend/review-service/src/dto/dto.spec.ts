import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { CreateReviewDto } from './create-review.dto';
import { UpdateReviewDto } from './update-review.dto';
import { PaginationDto } from './pagination.dto';

describe('DTO Validation', () => {
  describe('CreateReviewDto', () => {
    it('should pass validation with valid data', async () => {
      const dto = plainToClass(CreateReviewDto, {
        gameId: 'game-123',
        text: 'Отличная игра! Очень понравилась графика и геймплей.',
        rating: 5
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with short text', async () => {
      const dto = plainToClass(CreateReviewDto, {
        gameId: 'game-123',
        text: 'Короткий',
        rating: 5
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('text');
      expect(Object.values(errors[0].constraints || {})).toContain('Текст отзыва должен содержать от 10 до 1000 символов');
    });

    it('should fail validation with long text', async () => {
      const dto = plainToClass(CreateReviewDto, {
        gameId: 'game-123',
        text: 'a'.repeat(1001),
        rating: 5
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('text');
    });

    it('should fail validation with invalid rating (too low)', async () => {
      const dto = plainToClass(CreateReviewDto, {
        gameId: 'game-123',
        text: 'Отличная игра! Очень понравилась графика и геймплей.',
        rating: 0
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('rating');
      expect(errors[0].constraints?.min).toContain('Минимальный рейтинг - 1 звезда');
    });

    it('should fail validation with invalid rating (too high)', async () => {
      const dto = plainToClass(CreateReviewDto, {
        gameId: 'game-123',
        text: 'Отличная игра! Очень понравилась графика и геймплей.',
        rating: 6
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('rating');
      expect(errors[0].constraints?.max).toContain('Максимальный рейтинг - 5 звезд');
    });

    it('should fail validation with missing gameId', async () => {
      const dto = plainToClass(CreateReviewDto, {
        text: 'Отличная игра! Очень понравилась графика и геймплей.',
        rating: 5
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('gameId');
    });
  });

  describe('UpdateReviewDto', () => {
    it('should pass validation with valid partial data', async () => {
      const dto = plainToClass(UpdateReviewDto, {
        text: 'Обновленный отзыв о игре.'
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with empty object', async () => {
      const dto = plainToClass(UpdateReviewDto, {});

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with short text', async () => {
      const dto = plainToClass(UpdateReviewDto, {
        text: 'Короткий'
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('text');
    });

    it('should fail validation with invalid rating', async () => {
      const dto = plainToClass(UpdateReviewDto, {
        rating: 0
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
        limit: '20'
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

    it('should fail validation with invalid page (too low)', async () => {
      const dto = plainToClass(PaginationDto, {
        page: '0'
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('page');
    });

    it('should fail validation with invalid limit (too high)', async () => {
      const dto = plainToClass(PaginationDto, {
        limit: '100'
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('limit');
      expect(errors[0].constraints?.max).toContain('Максимальный лимит - 50 элементов');
    });

    it('should fail validation with non-numeric values', async () => {
      const dto = plainToClass(PaginationDto, {
        page: 'abc',
        limit: 'xyz'
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(2);
    });
  });
});