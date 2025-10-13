import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CorrelationService } from '../logging/correlation.service';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  constructor(private readonly correlationService: CorrelationService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const correlationContext = this.correlationService.createContextFromRequest(req);
    
    // Add correlation ID to response headers
    res.setHeader('X-Correlation-ID', correlationContext.correlationId);
    res.setHeader('X-Request-ID', correlationContext.requestId);
    
    // Run the request within correlation context
    this.correlationService.run(correlationContext, () => {
      next();
    });
  }
}