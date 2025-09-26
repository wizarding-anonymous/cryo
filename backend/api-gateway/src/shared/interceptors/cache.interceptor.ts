import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';
import type { RedisClient } from '../../redis/redis.constants';
import { createHash } from 'crypto';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly enabled: boolean;
  private readonly ttlMs: number;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {
    this.enabled = this.config.get<boolean>('CACHE_ENABLED', true);
    this.ttlMs = Number(this.config.get<number>('CACHE_TTL_MS', 30000));
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.enabled) return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    if (req.method.toUpperCase() !== 'GET') {
      return next.handle();
    }

    const key = this.buildKey(req);
    const client: RedisClient = this.redis.getClient();
    // Skip caching if Redis is not connected/ready (e.g., in tests)
    const status = (client as any)?.status as string | undefined;
    if (status && status !== 'ready') {
      return next.handle();
    }

    return new Observable((subscriber) => {
      void (async () => {
        try {
          const cached = await client.get(key);
          if (cached) {
            const payload = JSON.parse(cached) as {
              statusCode: number;
              headers: Record<string, string>;
              body: any;
            };
            // Set headers and respond immediately
            Object.entries(payload.headers || {}).forEach(([k, v]) =>
              res.setHeader(k, v),
            );
            res.status(payload.statusCode).send(payload.body);
            subscriber.complete();
            return;
          }

          // Patch res.send to capture response and cache it
          const originalSend = (res.send as any).bind(res);
          (res as any).send = async (body: any) => {
            try {
              const statusCode = res.statusCode;
              const headersRaw = res.getHeaders();
              const headers: Record<string, string> = {};
              Object.entries(headersRaw).forEach(([k, v]) => {
                if (typeof v === 'string') headers[k] = v;
                else if (Array.isArray(v)) headers[k] = v.join(', ');
                else if (typeof v !== 'undefined') headers[k] = String(v);
              });
              const payload = JSON.stringify({ statusCode, headers, body });
              await client.set(key, payload, 'PX', this.ttlMs);
            } catch {
              // ignore cache set errors
            }
            return originalSend(body);
          };

          // Continue to handler
          next.handle().subscribe({
            next: (v) => subscriber.next(v),
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });
        } catch (err) {
          // On cache error, proceed without caching
          next.handle().subscribe({
            next: (v) => subscriber.next(v),
            error: (e) => subscriber.error(e),
            complete: () => subscriber.complete(),
          });
        }
      })();
    });
  }

  private buildKey(req: Request): string {
    const url = (req.originalUrl || req.url || '/').split('?')[0];
    const query = req.query || {};
    const sortedQuery = Object.keys(query)
      .sort()
      .map((k) => `${k}=${String((query as any)[k])}`)
      .join('&');
    const base = `${req.method.toUpperCase()}:${url}?${sortedQuery}`;
    const auth = req.headers['authorization'];
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      const token = auth.slice(7);
      const hash = createHash('sha256').update(token).digest('hex');
      return `cache:${base}:auth:${hash}`;
    }
    return `cache:${base}`;
  }
}
