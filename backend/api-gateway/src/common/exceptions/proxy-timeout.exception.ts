import { HttpException } from '@nestjs/common';

export class ProxyTimeoutException extends HttpException {
  constructor(serviceName: string, timeout: number) {
    super(
      {
        error: 'PROXY_TIMEOUT',
        message: `Request to ${serviceName} timed out after ${timeout}ms`,
        service: serviceName,
        statusCode: 504,
      },
      504,
    );
  }
}
