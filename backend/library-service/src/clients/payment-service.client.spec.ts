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
    get: jest.fn((key: string) => {
      if (key === 'services.payment.url') {
        return 'http://payment-service';
      }
      return null;
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
    it('should return order status on success', async () => {
      const orderId = 'test-order-id';
      const mockResponse: AxiosResponse = {
        data: { status: 'completed' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: null },
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await client.getOrderStatus(orderId);

      expect(result).toEqual({ status: 'completed' });
      expect(httpService.get).toHaveBeenCalledWith(`http://payment-service/orders/${orderId}`);
    });

    it('should throw an error if the http call fails', async () => {
      const orderId = 'test-order-id';
      const error = new Error('API Error');
      mockHttpService.get.mockReturnValue(throwError(() => error));

      await expect(client.getOrderStatus(orderId)).rejects.toThrow('API Error');
    });
  });
});
