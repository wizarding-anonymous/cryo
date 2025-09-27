import { BadGatewayException } from './bad-gateway.exception';

describe('BadGatewayException', () => {
  it('should create exception with service name and custom message', () => {
    const exception = new BadGatewayException(
      'payment-service',
      'Invalid response format',
    );

    expect(exception.getStatus()).toBe(502);

    const response = exception.getResponse() as any;
    expect(response.error).toBe('BAD_GATEWAY');
    expect(response.message).toBe('Invalid response format');
    expect(response.service).toBe('payment-service');
    expect(response.statusCode).toBe(502);
  });

  it('should create exception with default message', () => {
    const exception = new BadGatewayException('game-service');

    expect(exception.getStatus()).toBe(502);

    const response = exception.getResponse() as any;
    expect(response.error).toBe('BAD_GATEWAY');
    expect(response.message).toBe('Bad response from game-service');
    expect(response.service).toBe('game-service');
    expect(response.statusCode).toBe(502);
  });
});
