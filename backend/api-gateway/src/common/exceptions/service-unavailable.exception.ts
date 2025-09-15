import { HttpException } from '@nestjs/common';

export class ServiceUnavailableException extends HttpException {
  constructor(serviceName: string, message?: string) {
    super(
      {
        error: 'SERVICE_UNAVAILABLE',
        message: message || `${serviceName} is temporarily unavailable`,
        service: serviceName,
        statusCode: 503,
      },
      503,
    );
  }
}

