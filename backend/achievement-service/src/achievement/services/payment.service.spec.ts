import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentService } from './payment.service';

// Mock fetch globally
global.fetch = jest.fn();

describe('PaymentService', () => {
  let service: PaymentService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://payment-service:3000'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    configService = module.get<ConfigService>(ConfigService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('getTransaction', () => {
    it('should get transaction successfully', async () => {
      const mockTransaction = {
        transactionId: 'tx-123',
        userId: 'user-1',
        gameId: 'game-1',
        amount: 1999,
        currency: 'RUB',
        status: 'completed',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ transaction: mockTransaction }),
      });

      const result = await service.getTransaction('tx-123');

      expect(result).toEqual(mockTransaction);
      expect(fetch).toHaveBeenCalledWith(
        'http://payment-service:3000/api/transactions/tx-123',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );
    });

    it('should return null when transaction not found', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await service.getTransaction('tx-nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when service error occurs', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.getTransaction('tx-123');

      expect(result).toBeNull();
    });

    it('should return null when network error occurs', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.getTransaction('tx-123');

      expect(result).toBeNull();
    });
  });

  describe('getUserTransactions', () => {
    it('should get user transactions successfully', async () => {
      const mockTransactions = [
        {
          transactionId: 'tx-1',
          userId: 'user-1',
          gameId: 'game-1',
          amount: 1999,
          currency: 'RUB',
          status: 'completed',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ transactions: mockTransactions }),
      });

      const result = await service.getUserTransactions('user-1');

      expect(result).toEqual(mockTransactions);
      expect(fetch).toHaveBeenCalledWith(
        'http://payment-service:3000/api/users/user-1/transactions?limit=50&offset=0',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );
    });

    it('should return empty array when service error occurs', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.getUserTransactions('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('getUserPaymentStats', () => {
    it('should get user payment stats successfully', async () => {
      const mockStats = {
        totalTransactions: 5,
        totalSpent: 9995,
        firstPurchaseDate: '2024-01-01T00:00:00.000Z',
        lastPurchaseDate: '2024-01-05T00:00:00.000Z',
        averageTransactionAmount: 1999,
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ stats: mockStats }),
      });

      const result = await service.getUserPaymentStats('user-1');

      expect(result).toEqual(mockStats);
    });

    it('should return null when service error occurs', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.getUserPaymentStats('user-1');

      expect(result).toBeNull();
    });
  });

  describe('checkPaymentServiceHealth', () => {
    it('should return true when service is healthy', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await service.checkPaymentServiceHealth();

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith('http://payment-service:3000/health', {
        method: 'GET',
        headers: {
          'X-Service-Name': 'achievement-service',
        },
      });
    });

    it('should return false when service is unhealthy', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.checkPaymentServiceHealth();

      expect(result).toBe(false);
    });

    it('should return false when network error occurs', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.checkPaymentServiceHealth();

      expect(result).toBe(false);
    });
  });

  describe('isTransactionCompleted', () => {
    it('should return true for completed transaction', async () => {
      const mockTransaction = {
        transactionId: 'tx-123',
        userId: 'user-1',
        gameId: 'game-1',
        amount: 1999,
        currency: 'RUB',
        status: 'completed',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ transaction: mockTransaction }),
      });

      const result = await service.isTransactionCompleted('tx-123');

      expect(result).toBe(true);
    });

    it('should return false for pending transaction', async () => {
      const mockTransaction = {
        transactionId: 'tx-123',
        userId: 'user-1',
        gameId: 'game-1',
        amount: 1999,
        currency: 'RUB',
        status: 'pending',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ transaction: mockTransaction }),
      });

      const result = await service.isTransactionCompleted('tx-123');

      expect(result).toBe(false);
    });

    it('should return false when transaction not found', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await service.isTransactionCompleted('tx-nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getUserCompletedTransactionsCount', () => {
    it('should return transaction count from stats', async () => {
      const mockStats = {
        totalTransactions: 5,
        totalSpent: 9995,
        averageTransactionAmount: 1999,
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ stats: mockStats }),
      });

      const result = await service.getUserCompletedTransactionsCount('user-1');

      expect(result).toBe(5);
    });

    it('should return 0 when stats not available', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.getUserCompletedTransactionsCount('user-1');

      expect(result).toBe(0);
    });
  });
});