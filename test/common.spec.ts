import { validate } from 'class-validator';
import { of } from 'rxjs';
import { HttpException, HttpStatus } from '@nestjs/common';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { IsAlphanumeric } from '../src/common/validators/is-alphanumeric.validator';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';

// Mock ExecutionContext for interceptors
const createMockExecutionContext = (request: any): any => ({
  switchToHttp: () => ({
    getRequest: () => request,
  }),
});

// Mock CallHandler for interceptors
const createMockCallHandler = (data: any): any => ({
  handle: () => of(data),
});

// Mock ArgumentsHost for filters
const createMockHost = (request: any, response: any): any => ({
  switchToHttp: () => ({
    getRequest: () => request,
    getResponse: () => response,
  }),
  getClass: () => {},
  getHandler: () => {},
});


describe('Common Components', () => {
  describe('LoggingInterceptor', () => {
    it('should log request and response', (done) => {
      const interceptor = new LoggingInterceptor();
      const context = createMockExecutionContext({ method: 'GET', url: '/test' });
      const handler = createMockCallHandler('test-data');

      interceptor.intercept(context, handler).subscribe({
        complete: () => {
          done();
        },
      });
    });
  });

  describe('TransformInterceptor', () => {
    it('should wrap response in a data object', (done) => {
      const interceptor = new TransformInterceptor();
      const handler = createMockCallHandler({ id: 1 });

      interceptor.intercept({} as any, handler).subscribe((response) => {
        expect(response).toEqual({ data: { id: 1 } });
        done();
      });
    });
  });

  describe('IsAlphanumeric Validator', () => {
    class TestDto {
      @IsAlphanumeric()
      value: string;
    }

    it('should pass for an alphanumeric string', async () => {
      const dto = new TestDto();
      dto.value = 'abc123';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail for a string with symbols', async () => {
      const dto = new TestDto();
      dto.value = 'abc-123';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('GlobalExceptionFilter', () => {
    let filter: GlobalExceptionFilter;
    let mockResponse;

    beforeEach(() => {
      filter = new GlobalExceptionFilter();
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
    });

    it('should catch HttpException and format response', () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
      const host = createMockHost({ url: '/test' }, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
        }),
      );
    });

    it('should catch non-HttpException and format as 500', () => {
      const exception = new Error('Generic error');
      const host = createMockHost({ url: '/test' }, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        }),
      );
    });
  });
});
