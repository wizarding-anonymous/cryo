import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const makeCtx = (headers: Record<string, string> = {}): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers } as any),
        getResponse: () => ({} as any),
      }),
    } as any);

  it('allows valid token and attaches user', async () => {
    const mockAuth = {
      validateBearerToken: jest.fn().mockResolvedValue({ id: 'u1', email: 'e', roles: [], permissions: [] }),
    } as any;
    const guard = new JwtAuthGuard(mockAuth);
    const ctx = makeCtx({ authorization: 'Bearer token' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockAuth.validateBearerToken).toHaveBeenCalled();
  });

  it('throws when header missing', async () => {
    const guard = new JwtAuthGuard({ validateBearerToken: jest.fn() } as any);
    await expect(guard.canActivate(makeCtx())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws when token invalid', async () => {
    const mockAuth = { validateBearerToken: jest.fn().mockRejectedValue(new UnauthorizedException()) } as any;
    const guard = new JwtAuthGuard(mockAuth);
    await expect(guard.canActivate(makeCtx({ authorization: 'Bearer x' }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

