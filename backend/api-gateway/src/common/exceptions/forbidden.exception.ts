import { HttpException } from '@nestjs/common';

export class ForbiddenException extends HttpException {
  constructor(message?: string) {
    super(
      {
        error: 'FORBIDDEN',
        message: message || 'Insufficient permissions',
        statusCode: 403,
      },
      403,
    );
  }
}