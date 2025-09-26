import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';
import { RateLimitService } from '../security/rate-limit.service';
import { AuthValidationService } from '../security/auth-validation.service';
import { RedisService } from '../redis/redis.service';
import type { Request, Response } from 'express';

describe('ProxyController', () => {
  let controller: ProxyController;
  let mockProxyService: jest.Mocked<ProxyService>;

  const mockRequest = {
    method: 'GET',
    path: '/api/users',
    url: '/api/users',
    headers: { 'authorization': 'Bearer token123' },
    body: undefined,
  } as Request;

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  } as unknown as Response;

  const mockProxyResult = {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: { id: 1, name: 'John' },
  };

  beforeEach(async () => {
    mockProxyService = {
      forward: jest.fn(),
    } as any;

    const mockRateLimitService = {
      isEnabled: jest.fn().mockReturnValue(false),
      check: jest.fn(),
    };

    const mockRedisService = {
      getClient: jest.fn().mockReturnValue({
        get: jest.fn(),
        set: jest.fn(),
        status: 'ready',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProxyController],
      providers: [
        {
          provide: ProxyService,
          useValue: mockProxyService,
        },
        {
          provide: RateLimitService,
          useValue: mockRateLimitService,
        },
        {
          provide: AuthValidationService,
          useValue: {
            validateBearerToken: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('*'),
          },
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    controller = module.get<ProxyController>(ProxyController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleGetRequest', () => {
    it('should forward GET request and return response', async () => {
      mockProxyService.forward.mockResolvedValue(mockProxyResult);

      await controller.handleGetRequest(mockRequest, mockResponse);

      expect(mockProxyService.forward).toHaveBeenCalledWith(mockRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.header).toHaveBeenCalledWith('content-type', 'application/json');
      expect(mockResponse.send).toHaveBeenCalledWith({ id: 1, name: 'John' });
    });

    it('should handle multiple headers correctly', async () => {
      const resultWithMultipleHeaders = {
        ...mockProxyResult,
        headers: {
          'content-type': 'application/json',
          'x-custom-header': 'custom-value',
          'cache-control': 'no-cache',
        },
      };
      mockProxyService.forward.mockResolvedValue(resultWithMultipleHeaders);

      await controller.handleGetRequest(mockRequest, mockResponse);

      expect(mockResponse.header).toHaveBeenCalledWith('content-type', 'application/json');
      expect(mockResponse.header).toHaveBeenCalledWith('x-custom-header', 'custom-value');
      expect(mockResponse.header).toHaveBeenCalledWith('cache-control', 'no-cache');
      expect(mockResponse.header).toHaveBeenCalledTimes(3);
    });

    it('should handle error responses', async () => {
      const errorResult = {
        statusCode: 404,
        headers: { 'content-type': 'application/json' },
        body: { error: 'NOT_FOUND', message: 'User not found' },
      };
      mockProxyService.forward.mockResolvedValue(errorResult);

      await controller.handleGetRequest(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.send).toHaveBeenCalledWith({
        error: 'NOT_FOUND',
        message: 'User not found',
      });
    });
  });

  describe('handlePostRequest', () => {
    it('should forward POST request with body', async () => {
      const postRequest = {
        ...mockRequest,
        method: 'POST',
        body: { name: 'Jane', email: 'jane@example.com' },
      } as Request;

      const postResult = {
        statusCode: 201,
        headers: { 'content-type': 'application/json' },
        body: { id: 2, name: 'Jane', email: 'jane@example.com' },
      };

      mockProxyService.forward.mockResolvedValue(postResult);

      await controller.handlePostRequest(postRequest, mockResponse);

      expect(mockProxyService.forward).toHaveBeenCalledWith(postRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.send).toHaveBeenCalledWith({
        id: 2,
        name: 'Jane',
        email: 'jane@example.com',
      });
    });

    it('should handle validation errors', async () => {
      const validationErrorResult = {
        statusCode: 400,
        headers: { 'content-type': 'application/json' },
        body: {
          error: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: ['name is required'],
        },
      };

      mockProxyService.forward.mockResolvedValue(validationErrorResult);

      await controller.handlePostRequest(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: ['name is required'],
      });
    });
  });

  describe('handlePutRequest', () => {
    it('should forward PUT request', async () => {
      const putRequest = {
        ...mockRequest,
        method: 'PUT',
        body: { name: 'Updated Name' },
      } as Request;

      mockProxyService.forward.mockResolvedValue(mockProxyResult);

      await controller.handlePutRequest(putRequest, mockResponse);

      expect(mockProxyService.forward).toHaveBeenCalledWith(putRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.send).toHaveBeenCalledWith({ id: 1, name: 'John' });
    });

    it('should handle PUT request with empty body', async () => {
      const putRequest = {
        ...mockRequest,
        method: 'PUT',
        body: {},
      } as Request;

      mockProxyService.forward.mockResolvedValue(mockProxyResult);

      await controller.handlePutRequest(putRequest, mockResponse);

      expect(mockProxyService.forward).toHaveBeenCalledWith(putRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });

  describe('handleDeleteRequest', () => {
    it('should forward DELETE request', async () => {
      const deleteRequest = {
        ...mockRequest,
        method: 'DELETE',
      } as Request;

      const deleteResult = {
        statusCode: 204,
        headers: {},
        body: null,
      };

      mockProxyService.forward.mockResolvedValue(deleteResult);

      await controller.handleDeleteRequest(deleteRequest, mockResponse);

      expect(mockProxyService.forward).toHaveBeenCalledWith(deleteRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalledWith(null);
    });

    it('should handle DELETE request with error', async () => {
      const deleteRequest = {
        ...mockRequest,
        method: 'DELETE',
      } as Request;

      const errorResult = {
        statusCode: 403,
        headers: { 'content-type': 'application/json' },
        body: { error: 'FORBIDDEN', message: 'Access denied' },
      };

      mockProxyService.forward.mockResolvedValue(errorResult);

      await controller.handleDeleteRequest(deleteRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.send).toHaveBeenCalledWith({
        error: 'FORBIDDEN',
        message: 'Access denied',
      });
    });
  });

  describe('error handling', () => {
    it('should handle proxy service errors in GET request', async () => {
      mockProxyService.forward.mockRejectedValue(new Error('Service unavailable'));

      await expect(
        controller.handleGetRequest(mockRequest, mockResponse)
      ).rejects.toThrow('Service unavailable');

      expect(mockProxyService.forward).toHaveBeenCalledWith(mockRequest);
    });

    it('should handle proxy service errors in POST request', async () => {
      mockProxyService.forward.mockRejectedValue(new Error('Network error'));

      await expect(
        controller.handlePostRequest(mockRequest, mockResponse)
      ).rejects.toThrow('Network error');
    });

    it('should handle proxy service errors in PUT request', async () => {
      mockProxyService.forward.mockRejectedValue(new Error('Timeout'));

      await expect(
        controller.handlePutRequest(mockRequest, mockResponse)
      ).rejects.toThrow('Timeout');
    });

    it('should handle proxy service errors in DELETE request', async () => {
      mockProxyService.forward.mockRejectedValue(new Error('Connection refused'));

      await expect(
        controller.handleDeleteRequest(mockRequest, mockResponse)
      ).rejects.toThrow('Connection refused');
    });
  });

  describe('response headers handling', () => {
    it('should handle empty headers object', async () => {
      const resultWithEmptyHeaders = {
        ...mockProxyResult,
        headers: {},
      };
      mockProxyService.forward.mockResolvedValue(resultWithEmptyHeaders);

      await controller.handleGetRequest(mockRequest, mockResponse);

      expect(mockResponse.header).not.toHaveBeenCalled();
      expect(mockResponse.send).toHaveBeenCalledWith({ id: 1, name: 'John' });
    });

    it('should handle headers with undefined values', async () => {
      const resultWithUndefinedHeaders = {
        ...mockProxyResult,
        headers: {
          'content-type': 'application/json',
          'x-undefined': undefined as any,
        },
      };
      mockProxyService.forward.mockResolvedValue(resultWithUndefinedHeaders);

      await controller.handleGetRequest(mockRequest, mockResponse);

      expect(mockResponse.header).toHaveBeenCalledWith('content-type', 'application/json');
      expect(mockResponse.header).toHaveBeenCalledWith('x-undefined', undefined);
    });

    it('should handle headers with null values', async () => {
      const resultWithNullHeaders = {
        ...mockProxyResult,
        headers: {
          'content-type': 'application/json',
          'x-null': null as any,
        },
      };
      mockProxyService.forward.mockResolvedValue(resultWithNullHeaders);

      await controller.handleGetRequest(mockRequest, mockResponse);

      expect(mockResponse.header).toHaveBeenCalledWith('content-type', 'application/json');
      expect(mockResponse.header).toHaveBeenCalledWith('x-null', null);
    });
  });
});