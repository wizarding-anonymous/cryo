import { HttpException } from '@nestjs/common';

export class BadGatewayException extends HttpException {
  constructor(serviceName: string, message?: string) {
    super(
      {
        error: 'BAD_GATEWAY',
        message: message || `Bad response from ${serviceName}`,
        service: serviceName,
        statusCode: 502,
      },
      502,
    );
  }
}