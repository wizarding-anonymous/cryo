import { UnauthorizedException } from './unauthorized.exception';

describe('UnauthorizedException', () => {
  it('should create exception with custom message', () => {
    const exception = new UnauthorizedException('Invalid JWT token');

    expect(exception.getStatus()).toBe(401);
    
    const response = exception.getResponse() as any;
    expect(response.error).toBe('UNAUTHORIZED');
    expect(response.message).toBe('Invalid JWT token');
    expect(response.statusCode).toBe(401);
  });

  it('should create exception with default message', () => {
    const exception = new UnauthorizedException();

    expect(exception.getStatus()).toBe(401);
    
    const response = exception.getResponse() as any;
    expect(response.error).toBe('UNAUTHORIZED');
    expect(response.message).toBe('Authentication required');
    expect(response.statusCode).toBe(401);
  });
});