import { JwtAuthGuard } from './jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  const createMockExecutionContext = (headers: any) => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
        }),
      }),
    } as ExecutionContext;
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true for a valid bearer token', () => {
    const mockContext = createMockExecutionContext({
      authorization: 'Bearer valid-token',
    });
    const canActivate = guard.canActivate(mockContext);
    expect(canActivate).toBe(true);
  });

  it('should attach user to request for a valid token', () => {
    const request = { headers: { authorization: 'Bearer valid-token' } };
    const mockContext = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;

    guard.canActivate(mockContext);
    expect((request as any).user).toBeDefined();
    expect((request as any).user.userId).toEqual(
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    );
  });

  it('should throw UnauthorizedException if no auth header', () => {
    const mockContext = createMockExecutionContext({});
    expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if not a bearer token', () => {
    const mockContext = createMockExecutionContext({
      authorization: 'Basic some-token',
    });
    expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if token is missing', () => {
    const mockContext = createMockExecutionContext({
      authorization: 'Bearer ',
    });
    expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
  });
});
