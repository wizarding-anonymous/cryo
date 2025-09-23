import { Inject, Injectable, NestMiddleware, LoggerService } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    const { method, originalUrl } = req;
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      this.logger.log('HTTP request', {
        method,
        url: originalUrl ?? req.url,
        status: res.statusCode,
        durationMs,
        ip,
        userId: (req as any)?.user?.id ?? null,
        correlationId,
      });
    });

    next();
  }
}
