import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { randomUUID } from 'crypto';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request & { id?: string }>();
    
    // Generate or extract request ID
    let requestId = req.headers['x-request-id'];
    if (!requestId) {
      requestId = (req as any).id || randomUUID();
      (req as any).id = requestId as string;
    }
    
    // Set standard response headers
    const finalRequestId = Array.isArray(requestId) ? requestId[0] : (requestId as string);
    res.setHeader('X-Request-Id', finalRequestId);
    res.setHeader('X-Timestamp', new Date().toISOString());
    res.setHeader('X-Gateway-Version', '1.0.0');
    
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    return next.handle().pipe(
      map((data) => {
        // For JSON responses, add metadata if it's an object
        if (data && typeof data === 'object' && !Buffer.isBuffer(data)) {
          return {
            ...data,
            _metadata: {
              requestId: finalRequestId,
              timestamp: new Date().toISOString(),
              gateway: 'cryo-api-gateway',
            },
          };
        }
        return data;
      }),
    );
  }
}
