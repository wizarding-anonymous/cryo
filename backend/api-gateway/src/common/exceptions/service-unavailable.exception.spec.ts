import { ServiceUnavailableException } from './service-unavailable.exception';

describe('ServiceUnavailableException', () => {
  it('should create exception with service name and custom message', () => {
    const exception = new ServiceUnavailableException(
      'game-service',
      'Service is under maintenance',
    );

    expect(exception.getStatus()).toBe(503);

    const response = exception.getResponse() as any;
    expect(response.error).toBe('SERVICE_UNAVAILABLE');
    expect(response.message).toBe('Service is under maintenance');
    expect(response.service).toBe('game-service');
    expect(response.statusCode).toBe(503);
  });

  it('should create exception with default message', () => {
    const exception = new ServiceUnavailableException('payment-service');

    expect(exception.getStatus()).toBe(503);

    const response = exception.getResponse() as any;
    expect(response.error).toBe('SERVICE_UNAVAILABLE');
    expect(response.message).toBe('payment-service is temporarily unavailable');
    expect(response.service).toBe('payment-service');
    expect(response.statusCode).toBe(503);
  });
});
