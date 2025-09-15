import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { OptionalAuthGuard } from './optional-auth.guard';

describe('OptionalAuthGuard', () => {
  const makeCtx = (headers: Record<string, string> = {}): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers } as any),
        getResponse: () => ({} as any),
      }),
    } as any);

  it('passes without auth header', async () => {
    const guard = new OptionalAuthGuard({ validateBearerToken: jest.fn() } as any);
    await expect(guard.canActivate(makeCtx())).resolves.toBe(true);
  });

  it('validates when token present', async () => {
    const mockAuth = {
      validateBearerToken: jest.fn().mockResolvedValue({ id: 'u1', email: 'e', roles: [], permissions: [] }),
    } as any;
    const guard = new OptionalAuthGuard(mockAuth);
    await expect(guard.canActivate(makeCtx({ authorization: 'Bearer t' }))).resolves.toBe(true);
    expect(mockAuth.validateBearerToken).toHaveBeenCalled();
  });

  it('throws 401 on invalid token', async () => {
    const guard = new OptionalAuthGuard({ validateBearerToken: jest.fn().mockRejectedValue(new Error()) } as any);
    await expect(guard.canActivate(makeCtx({ authorization: 'Bearer bad' }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

