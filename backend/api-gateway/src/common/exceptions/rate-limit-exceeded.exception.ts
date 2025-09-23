import { HttpException } from '@nestjs/common';

export class RateLimitExceededException extends HttpException {
  constructor(limit: number, windowMs: number) {
    super(
      {
        error: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded: ${limit} requests per ${windowMs}ms`,
        statusCode: 429,
      },
      429,
    );
  }
}

