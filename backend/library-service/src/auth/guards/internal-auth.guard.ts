import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Allow all in test environment to enable E2E flows without external S2S auth
    if ((process.env.NODE_ENV || '').toLowerCase() === 'test') {
      return true;
    }
    const request = context.switchToHttp().getRequest();

    // Allow if request has a user with internal role (service-to-service via JWT)
    const user = request.user as { roles?: string[] } | undefined;
    if (user?.roles?.some((r) => r === 'internal-service' || r === 'admin')) {
      return true;
    }

    // Or allow via internal API key header
    const headerKey = request.headers['x-internal-api-key'] || request.headers['x-internal-key'];
    const expected = process.env.INTERNAL_API_KEY;
    if (expected && headerKey && headerKey === expected) {
      return true;
    }

    throw new UnauthorizedException('Internal endpoint requires internal auth');
  }
}
