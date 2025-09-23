import { InternalAuthGuard } from './internal-auth.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

describe('InternalAuthGuard', () => {
  let guard: InternalAuthGuard;

  beforeEach(() => {
    guard = new InternalAuthGuard();
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

  it('should return true for valid internal service token', () => {
    const mockContext = createMockExecutionContext({
      'x-internal-token': 'change-me-internal-token',
    });

    const result = guard.canActivate(mockContext);
    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException for missing internal service header', () => {
    const mockContext = createMockExecutionContext({});

    expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for invalid internal service token', () => {
    const mockContext = createMockExecutionContext({
      'x-internal-token': 'invalid-token',
    });

    expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
  });
});
