import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_META_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';
import { RateLimitService } from '../../modules/security/rate-limit.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly rl: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const opts = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_META_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!opts) return true;
    const req = context.switchToHttp().getRequest();
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const userId = req.user?.id as string | undefined;
    let keyPart: string;
    switch (opts.keyBy ?? 'ip') {
      case 'user':
        keyPart = userId ?? `ip:${ip}`;
        break;
      case 'path':
        keyPart = req.path;
        break;
      default:
        keyPart = ip;
    }
    const key = `security:guard:${opts.name}:${keyPart}`;
    const res = await this.rl.checkRateLimit(key, opts.limit, opts.window);
    if (!res.allowed) {
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
