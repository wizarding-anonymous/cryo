import { ServiceException } from './service.exception';

describe('ServiceException', () => {
  it('should create exception with service name and details', () => {
    const exception = new ServiceException(
      'Service error occurred',
      503,
      'user-service',
      { code: 'CONNECTION_FAILED' }
    );

    expect(exception.getStatus()).toBe(503);
    
    const response = exception.getResponse() as any;
    expect(response.error).toBe('SERVICE_ERROR');
    expect(response.message).toBe('Service error occurred');
    expect(response.service).toBe('user-service');
    expect(response.statusCode).toBe(503);
    expect(response.details).toEqual({ code: 'CONNECTION_FAILED' });
  });

  it('should create exception without optional parameters', () => {
    const exception = new ServiceException('Basic service error', 500);

    expect(exception.getStatus()).toBe(500);
    
    const response = exception.getResponse() as any;
    expect(response.error).toBe('SERVICE_ERROR');
    expect(response.message).toBe('Basic service error');
    expect(response.statusCode).toBe(500);
    expect(response.service).toBeUndefined();
    expect(response.details).toBeUndefined();
  });
});