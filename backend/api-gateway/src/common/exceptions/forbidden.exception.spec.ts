import { ForbiddenException } from './forbidden.exception';

describe('ForbiddenException', () => {
  it('should create exception with custom message', () => {
    const exception = new ForbiddenException('Access denied for this resource');

    expect(exception.getStatus()).toBe(403);

    const response = exception.getResponse() as any;
    expect(response.error).toBe('FORBIDDEN');
    expect(response.message).toBe('Access denied for this resource');
    expect(response.statusCode).toBe(403);
  });

  it('should create exception with default message', () => {
    const exception = new ForbiddenException();

    expect(exception.getStatus()).toBe(403);

    const response = exception.getResponse() as any;
    expect(response.error).toBe('FORBIDDEN');
    expect(response.message).toBe('Insufficient permissions');
    expect(response.statusCode).toBe(403);
  });
});
