import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, of } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CorsInterceptor implements NestInterceptor {
  private readonly enabled: boolean;
  private readonly origin: string;
  private readonly methods: string;
  private readonly headers: string;
  private readonly credentials: boolean;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<boolean>('CORS_ENABLED', true) as boolean;
    this.origin = this.config.get<string>('CORS_ORIGIN', '*') as string;
    this.methods = this.config.get<string>(
      'CORS_METHODS',
      'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    ) as string;
    this.headers = this.config.get<string>('CORS_HEADERS', 'Content-Type, Authorization') as string;
    this.credentials = this.config.get<boolean>('CORS_CREDENTIALS', true) as boolean;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.enabled) return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    res.setHeader('Access-Control-Allow-Origin', this.origin);
    res.setHeader('Access-Control-Allow-Methods', this.methods);
    res.setHeader('Access-Control-Allow-Headers', this.headers);
    res.setHeader('Vary', 'Origin');
    if (this.credentials) res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method.toUpperCase() === 'OPTIONS') {
      res.status(204).send();
      return of(undefined);
    }

    return next.handle();
  }
}

