import { HttpException } from '@nestjs/common';

export class UnauthorizedException extends HttpException {
  constructor(message?: string) {
    super(
      {
        error: 'UNAUTHORIZED',
        message: message || 'Authentication required',
        statusCode: 401,
      },
      401,
    );
  }
}