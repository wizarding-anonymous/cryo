import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Response, Request } from 'express';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Ensure X-Request-Id header is present in the response
    const http = context.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request & { id?: string }>();
    let requestId = req.headers['x-request-id'];
    if (!requestId) {
      requestId = (req as any).id || randomUUID();
      (req as any).id = requestId as string;
    }
    res.setHeader('X-Request-Id', Array.isArray(requestId) ? requestId[0] : (requestId as string));
    return next.handle();
  }
}
