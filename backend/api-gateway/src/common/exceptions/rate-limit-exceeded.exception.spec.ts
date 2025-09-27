import { RateLimitExceededException } from './rate-limit-exceeded.exception';

describe('RateLimitExceededException', () => {
  it('should create exception with limit and window parameters', () => {
    const exception = new RateLimitExceededException(100, 60000);

    expect(exception.getStatus()).toBe(429);

    const response = exception.getResponse() as any;
    expect(response.error).toBe('RATE_LIMIT_EXCEEDED');
    expect(response.message).toBe(
      'Rate limit exceeded: 100 requests per 60000ms',
    );
    expect(response.statusCode).toBe(429);
  });

  it('should create exception with different limit values', () => {
    const exception = new RateLimitExceededException(50, 30000);

    expect(exception.getStatus()).toBe(429);

    const response = exception.getResponse() as any;
    expect(response.error).toBe('RATE_LIMIT_EXCEEDED');
    expect(response.message).toBe(
      'Rate limit exceeded: 50 requests per 30000ms',
    );
    expect(response.statusCode).toBe(429);
  });
});
