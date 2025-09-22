import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

describe('RequestLoggingInterceptor', () => {
  let interceptor: RequestLoggingInterceptor;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(async () => {
    mockRequest = {
      method: 'GET',
      originalUrl: '/api/games',
    };

    mockResponse = {
      statusCode: 200,
    };

    const mockHttpContext = {
      getRequest: jest.fn().mockReturnValue(mockRequest),
      getResponse: jest.fn().mockReturnValue(mockResponse),
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue(mockHttpContext),
      getClass: jest.fn(),
      getHandler: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    };

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of('test response')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RequestLoggingInterceptor],
    }).compile();

    interceptor = module.get<RequestLoggingInterceptor>(RequestLoggingInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    it('should log GET request with 200 status', (done) => {
      const logSpy = jest.spyOn(interceptor['logger'], 'log');

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result.subscribe(() => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringMatching(/GET \/api\/games 200 - \d+ms/),
        );
        done();
      });
    });

    it('should log POST request with 201 status', (done) => {
      mockRequest.method = 'POST';
      mockRequest.originalUrl = '/api/games';
      mockResponse.statusCode = 201;

      const logSpy = jest.spyOn(interceptor['logger'], 'log');

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result.subscribe(() => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringMatching(/POST \/api\/games 201 - \d+ms/),
        );
        done();
      });
    });

    it('should log PUT request with 200 status', (done) => {
      mockRequest.method = 'PUT';
      mockRequest.originalUrl = '/api/games/123';
      mockResponse.statusCode = 200;

      const logSpy = jest.spyOn(interceptor['logger'], 'log');

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result.subscribe(() => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringMatching(/PUT \/api\/games\/123 200 - \d+ms/),
        );
        done();
      });
    });

    it('should log DELETE request with 204 status', (done) => {
      mockRequest.method = 'DELETE';
      mockRequest.originalUrl = '/api/games/123';
      mockResponse.statusCode = 204;

      const logSpy = jest.spyOn(interceptor['logger'], 'log');

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result.subscribe(() => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringMatching(/DELETE \/api\/games\/123 204 - \d+ms/),
        );
        done();
      });
    });

    it('should measure and log response time', (done) => {
      const logSpy = jest.spyOn(interceptor['logger'], 'log');
      
      // Mock a delay in the response
      mockCallHandler.handle = jest.fn().mockReturnValue(
        of('test response').pipe(
          // Simulate some processing time
        ),
      );

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result.subscribe(() => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringMatching(/GET \/api\/games 200 - \d+ms/),
        );
        
        // Verify that the logged message contains a time measurement
        const logCall = logSpy.mock.calls[0][0];
        const timeMatch = logCall.match(/(\d+)ms/);
        expect(timeMatch).toBeTruthy();
        expect(parseInt(timeMatch[1])).toBeGreaterThanOrEqual(0);
        
        done();
      });
    });

    it('should handle requests with query parameters', (done) => {
      mockRequest.originalUrl = '/api/games?page=1&limit=10';
      const logSpy = jest.spyOn(interceptor['logger'], 'log');

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result.subscribe(() => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringMatching(/GET \/api\/games\?page=1&limit=10 200 - \d+ms/),
        );
        done();
      });
    });

    it('should handle search requests', (done) => {
      mockRequest.originalUrl = '/api/games/search?q=action';
      const logSpy = jest.spyOn(interceptor['logger'], 'log');

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result.subscribe(() => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringMatching(/GET \/api\/games\/search\?q=action 200 - \d+ms/),
        );
        done();
      });
    });

    it('should call next.handle() and return the result', (done) => {
      const testResponse = { id: '1', title: 'Test Game' };
      mockCallHandler.handle = jest.fn().mockReturnValue(of(testResponse));

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result.subscribe((response) => {
        expect(mockCallHandler.handle).toHaveBeenCalled();
        expect(response).toEqual(testResponse);
        done();
      });
    });
  });
});