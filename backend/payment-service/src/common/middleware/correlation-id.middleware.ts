import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AlsService } from '../als/als.service';

export interface RequestWithCorrelationId extends Request {
  correlationId: string;
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(private readonly alsService: AlsService) {}

  use(req: RequestWithCorrelationId, res: Response, next: NextFunction) {
    // Get correlation ID from header or generate new one
    const correlationId =
      (req.headers['x-correlation-id'] as string) ||
      (req.headers['x-request-id'] as string) ||
      uuidv4();

    // Set correlation ID on request
    req.correlationId = correlationId;

    // Set correlation ID in response header
    res.setHeader('x-correlation-id', correlationId);

    // Run the request in async local storage context
    this.alsService.run(correlationId, () => {
      next();
    });
  }
}
