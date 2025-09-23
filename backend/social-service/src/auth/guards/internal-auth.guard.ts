import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  private readonly internalToken = process.env.INTERNAL_API_TOKEN || 'change-me-internal-token';

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header = request.headers['x-internal-token'] as string | undefined;
    if (!header || header !== this.internalToken) {
      throw new UnauthorizedException('Invalid internal token');
    }
    return true;
  }
}
