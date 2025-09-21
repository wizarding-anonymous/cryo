import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosError } from 'axios';
import { ExternalServiceBase, ExternalServiceError } from './external-service.base';

// Конкретная реализация для тестирования
class TestExternalService extends ExternalServiceBase {
  async testRequest<T>(url: string, serviceName: string, operation: string): Promise<T> {
    return this.makeRequestWithRetry<T>(url, {}, {}, serviceName, operation);
  }

  testGetServiceUrl(serviceName: string): string {
    return this.getServiceUrl(serviceName);
  }

  testCreateError(service: string, operation: string, statusCode?: number, message?: string, retryable?: boolean): ExternalServiceError {
    return this.createExternalServiceError(service, operation, statusCode, message, retryable);
  }
}

describe('ExternalServiceBase', () => {
  let service: TestExternalService;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockHttpService = {
      request: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestExternalService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TestExternalService>(TestExternalService);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('makeRequestWithRetry', () => {
    it('should return data on successful request', async () => {
      const mockResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));

      const result = await service.testRequest('http://test.com', 'test', 'operation');

      expect(result).toEqual({ success: true });
      expect(httpService.request).toHaveBeenCalledTimes(1);
    });

    it('should retry on server errors', async () => {
      const serverError = {
        message: 'Server Error',
        name: 'AxiosError',
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: {},
          headers: {},
          config: {} as any,
        },
        isAxiosError: true,
      } as AxiosError;

      httpService.request
        .mockReturnValueOnce(throwError(() => serverError))
        .mockReturnValueOnce(throwError(() => serverError))
        .mockReturnValueOnce(of({
          data: { success: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        }));

      const result = await service.testRequest('http://test.com', 'test', 'operation');

      expect(result).toEqual({ success: true });
      expect(httpService.request).toHaveBeenCalledTimes(3);
    });

    it('should not retry on client errors (4xx)', async () => {
      const clientError = {
        message: 'Not Found',
        name: 'AxiosError',
        response: {
          status: 404,
          statusText: 'Not Found',
          data: {},
          headers: {},
          config: {} as any,
        },
        isAxiosError: true,
      } as AxiosError;

      httpService.request.mockReturnValue(throwError(() => clientError));

      await expect(service.testRequest('http://test.com', 'test', 'operation'))
        .rejects.toThrow();

      expect(httpService.request).toHaveBeenCalledTimes(1);
    });

    it('should throw ExternalServiceError after max retries', async () => {
      const serverError = {
        message: 'Server Error',
        name: 'AxiosError',
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: {},
          headers: {},
          config: {} as any,
        },
        isAxiosError: true,
      } as AxiosError;

      httpService.request.mockReturnValue(throwError(() => serverError));

      await expect(service.testRequest('http://test.com', 'test', 'operation'))
        .rejects.toThrow(ExternalServiceError);

      expect(httpService.request).toHaveBeenCalledTimes(3); // Default max retries
    });
  });

  describe('getServiceUrl', () => {
    it('should return service URL from config', () => {
      configService.get.mockReturnValue('http://library-service:3001');

      const url = service.testGetServiceUrl('library');

      expect(url).toBe('http://library-service:3001');
      expect(configService.get).toHaveBeenCalledWith('app.services.library');
    });
  });

  describe('createExternalServiceError', () => {
    it('should create ExternalServiceError with all properties', () => {
      const error = service.testCreateError('test', 'operation', 500, 'Server Error', true);

      expect(error).toBeInstanceOf(ExternalServiceError);
      expect(error.service).toBe('test');
      expect(error.operation).toBe('operation');
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Server Error');
      expect(error.retryable).toBe(true);
    });

    it('should create ExternalServiceError with default message', () => {
      const error = service.testCreateError('test', 'operation');

      expect(error).toBeInstanceOf(ExternalServiceError);
      expect(error.service).toBe('test');
      expect(error.operation).toBe('operation');
      expect(error.statusCode).toBeUndefined();
      expect(error.message).toBe('External service error');
      expect(error.retryable).toBe(false);
    });
  });
});