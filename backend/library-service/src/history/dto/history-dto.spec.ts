import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import {
  CreatePurchaseRecordDto,
  SearchHistoryDto,
  HistoryQueryDto,
} from './index';
import { PurchaseStatus } from '../../common/enums';

describe('History DTOs', () => {
  describe('CreatePurchaseRecordDto', () => {
    it('should validate valid purchase record data', async () => {
      const dto = plainToClass(CreatePurchaseRecordDto, {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        gameId: '123e4567-e89b-12d3-a456-426614174001',
        orderId: '123e4567-e89b-12d3-a456-426614174002',
        amount: 59.99,
        currency: 'RUB',
        status: PurchaseStatus.COMPLETED,
        paymentMethod: 'credit_card',
        metadata: { transactionId: 'tx_123456' },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid status', async () => {
      const dto = plainToClass(CreatePurchaseRecordDto, {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        gameId: '123e4567-e89b-12d3-a456-426614174001',
        orderId: '123e4567-e89b-12d3-a456-426614174002',
        amount: 59.99,
        currency: 'RUB',
        status: 'invalid_status',
        paymentMethod: 'credit_card',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('status');
    });

    it('should reject payment method too long', async () => {
      const dto = plainToClass(CreatePurchaseRecordDto, {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        gameId: '123e4567-e89b-12d3-a456-426614174001',
        orderId: '123e4567-e89b-12d3-a456-426614174002',
        amount: 59.99,
        currency: 'RUB',
        status: PurchaseStatus.COMPLETED,
        paymentMethod: 'a'.repeat(101),
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('paymentMethod');
    });
  });

  describe('SearchHistoryDto', () => {
    it('should validate valid search history data', async () => {
      const dto = plainToClass(SearchHistoryDto, {
        query: 'cyberpunk',
        status: PurchaseStatus.COMPLETED,
        fromDate: '2024-01-01T00:00:00Z',
        toDate: '2024-12-31T23:59:59Z',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid date format', async () => {
      const dto = plainToClass(SearchHistoryDto, {
        query: 'cyberpunk',
        fromDate: 'invalid-date',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('fromDate');
    });
  });

  describe('HistoryQueryDto', () => {
    it('should validate valid history query', async () => {
      const dto = plainToClass(HistoryQueryDto, {
        status: PurchaseStatus.COMPLETED,
        fromDate: '2024-01-01T00:00:00Z',
        toDate: '2024-12-31T23:59:59Z',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate without optional fields', async () => {
      const dto = plainToClass(HistoryQueryDto, {});

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
