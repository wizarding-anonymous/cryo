import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RateLimitService } from '../rate-limit.service';
import { RateLimitExceededException } from '../../common/exceptions/rate-limit-exceeded.exception';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly rateLimitService: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.rateLimitService.isEnabled()) return true;

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { ip: string }>();
    const res = http.getResponse<Response>();

    const ip = this.extractIp(req);
    const route = this.extractPath(req);
    const method = req.method.toUpperCase();

    const result = await this.rateLimitService.check(ip, route, method);

    res.setHeader('X-RateLimit-Limit', String(result.limit));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.reset / 1000))); // seconds epoch

    if (!result.allowed) {
      throw new RateLimitExceededException(result.limit, result.windowMs);
    }
    return true;
  }

  private extractIp(req: Request & { ip: string }): string {
    const xf = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
    return xf || req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
  }

  private extractPath(req: Request): string {
    const url = req.originalUrl || req.url || '';
    const q = url.indexOf('?');
    return (q >= 0 ? url.substring(0, q) : url) || '/';
  }
}
