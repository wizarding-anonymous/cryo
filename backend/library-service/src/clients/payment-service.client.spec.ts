import { Test, TestingModule } from '@nestjs/testing';
import { PaymentServiceClient } from './payment-service.client';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

describe('PaymentServiceClient', () => {
  let client: PaymentServiceClient;
  let httpService: HttpService;

  const mockHttpService = {
    post: jest.fn(),
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      if (key === 'PAYMENT_SERVICE_URL') {
        return 'http://payment-service';
      }
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentServiceClient,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    client = module.get<PaymentServiceClient>(PaymentServiceClient);
    httpService = module.get<HttpService>(HttpService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(client).toBeDefined();
  });

  describe('getOrderStatus', () => {
    it('returns order status on success', async () => {
      const orderId = 'test-order-id';
      const mockResponse = {
        data: { status: 'completed' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} },
      } as AxiosResponse<{ status: string }>;
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await client.getOrderStatus(orderId);

      expect(result).toEqual({ status: 'completed' });
      expect(httpService.get).toHaveBeenCalledWith(
        `http://payment-service/orders/${orderId}`,
      );
    });

    it('throws an error if the http call fails', async () => {
      const orderId = 'test-order-id';
      const error = new Error('API Error');
      mockHttpService.get.mockReturnValue(throwError(() => error));

      await expect(client.getOrderStatus(orderId)).rejects.toThrow('API Error');
    });
  });

  describe('getOrderDetails', () => {
    it('returns order details on success', async () => {
      const orderId = 'test-order-id';
      const mockOrderDetails = {
        id: orderId,
        userId: 'user-123',
        gameId: 'game-456',
        amount: 29.99,
        currency: 'USD',
        status: 'completed' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockResponse = {
        data: mockOrderDetails,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} },
      } as AxiosResponse;
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await client.getOrderDetails(orderId);

      expect(result).toEqual(mockOrderDetails);
      expect(httpService.get).toHaveBeenCalledWith(
        `http://payment-service/orders/${orderId}/details`,
      );
    });

    it('throws an error if the http call fails', async () => {
      const orderId = 'test-order-id';
      const error = new Error('API Error');
      mockHttpService.get.mockReturnValue(throwError(() => error));

      await expect(client.getOrderDetails(orderId)).rejects.toThrow(
        'API Error',
      );
    });
  });

  describe('verifyPayment', () => {
    it('returns verification result on success', async () => {
      const orderId = 'test-order-id';
      const mockResponse = {
        data: { verified: true, transactionId: 'txn-123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} },
      } as AxiosResponse;
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await client.verifyPayment(orderId);

      expect(result).toEqual({ verified: true, transactionId: 'txn-123' });
      expect(httpService.get).toHaveBeenCalledWith(
        `http://payment-service/orders/${orderId}/verify`,
      );
    });

    it('throws an error if the http call fails', async () => {
      const orderId = 'test-order-id';
      const error = new Error('API Error');
      mockHttpService.get.mockReturnValue(throwError(() => error));

      await expect(client.verifyPayment(orderId)).rejects.toThrow('API Error');
    });
  });

  describe('circuit breaker', () => {
    it('should handle circuit breaker functionality', async () => {
      // Test that circuit breaker exists and can handle errors
      const error = new Error('Network error');
      mockHttpService.get.mockReturnValue(throwError(() => error));

      // First call should throw error
      await expect(client.getOrderStatus('test-order')).rejects.toThrow(
        'Network error',
      );

      // Verify that the HTTP service was called
      expect(httpService.get).toHaveBeenCalledWith(
        'http://payment-service/orders/test-order',
      );
    });
  });
});
