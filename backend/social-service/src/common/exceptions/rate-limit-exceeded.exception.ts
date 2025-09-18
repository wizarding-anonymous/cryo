import { HttpException, HttpStatus } from '@nestjs/common';

export class RateLimitExceededException extends HttpException {
  constructor(limit: number) {
    super(
      {
        error: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded: ${limit} messages per minute`,
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
