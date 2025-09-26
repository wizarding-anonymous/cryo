import { ProxyTimeoutException } from './proxy-timeout.exception';

describe('ProxyTimeoutException', () => {
  it('should create exception with service name and timeout', () => {
    const exception = new ProxyTimeoutException('user-service', 5000);

    expect(exception.getStatus()).toBe(504);
    
    const response = exception.getResponse() as any;
    expect(response.error).toBe('PROXY_TIMEOUT');
    expect(response.message).toBe('Request to user-service timed out after 5000ms');
    expect(response.service).toBe('user-service');
    expect(response.statusCode).toBe(504);
  });

  it('should create exception with different service and timeout values', () => {
    const exception = new ProxyTimeoutException('payment-service', 10000);

    expect(exception.getStatus()).toBe(504);
    
    const response = exception.getResponse() as any;
    expect(response.error).toBe('PROXY_TIMEOUT');
    expect(response.message).toBe('Request to payment-service timed out after 10000ms');
    expect(response.service).toBe('payment-service');
    expect(response.statusCode).toBe(504);
  });
});