import { Injectable, NestMiddleware } from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { SecurityService } from '../../modules/security/security.service';

@Injectable()
export class IpBlockMiddleware implements NestMiddleware {
  constructor(private readonly security: SecurityService) {}

  async use(req: any, res: Response, next: NextFunction) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    if (!ip) return next();
    try {
      const blocked = await this.security.isIPBlocked(ip);
      if (blocked) {
        return res.status(403).json({
          error: { code: 'IP_BLOCKED', message: 'IP is blocked' },
          timestamp: new Date().toISOString(),
          path: req.originalUrl ?? req.url,
        });
      }
    } catch (_e) {
      // On middleware errors (e.g., Redis/DB temporary), do not block request
    }
    return next();
  }
}
