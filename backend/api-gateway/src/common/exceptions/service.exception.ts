import { HttpException } from '@nestjs/common';

/**
 * Base class for service-related exceptions
 * Provides a standardized way to handle errors from microservices
 */
export class ServiceException extends HttpException {
  constructor(
    message: string,
    statusCode: number,
    serviceName?: string,
    details?: any,
  ) {
    super(
      {
        error: 'SERVICE_ERROR',
        message,
        service: serviceName,
        statusCode,
        details,
      },
      statusCode,
    );
  }
}