import { Injectable, NestMiddleware, Logger, ConflictException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { IdempotencyService, IdempotencyRequest } from './idempotency.service';

export interface IdempotentRequest extends Request {
  idempotencyKey?: string;
  idempotencyRequest?: IdempotencyRequest;
  clientIp?: string;
}

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IdempotencyMiddleware.name);
  
  // Methods that support idempotency
  private readonly idempotentMethods = new Set(['POST']);
  
  // Paths that support idempotency
  private readonly idempotentPaths = new Set([
    '/auth/register',
    '/auth/login',
    '/auth/logout',
  ]);

  constructor(private readonly idempotencyService: IdempotencyService) {}

  async use(req: IdempotentRequest, res: Response, next: NextFunction): Promise<void> {
    // Only process idempotent methods and paths
    if (!this.shouldProcessIdempotency(req)) {
      return next();
    }

    const idempotencyKey = this.extractIdempotencyKey(req);
    if (!idempotencyKey) {
      return next();
    }

    try {
      // Extract client IP for logging
      const clientIp = this.extractClientIp(req);
      
      // Create idempotency request object
      const idempotencyRequest: IdempotencyRequest = {
        method: req.method,
        url: req.url,
        body: req.body,
        userId: this.extractUserId(req),
      };

      // Store client IP for use in service
      req.clientIp = clientIp;

      // Store for use in interceptor
      req.idempotencyKey = idempotencyKey;
      req.idempotencyRequest = idempotencyRequest;

      // Check if we have a cached result
      const cachedResult = await this.idempotencyService.getResult(
        idempotencyKey,
        idempotencyRequest,
      );

      if (cachedResult) {
        this.logger.debug('Returning cached idempotent result', {
          idempotencyKey,
          method: req.method,
          url: req.url,
          statusCode: cachedResult.statusCode,
          age: Date.now() - cachedResult.timestamp.getTime(),
        });

        // Return cached response
        res.status(cachedResult.statusCode);
        
        // Set cached headers if any
        if (cachedResult.headers) {
          Object.entries(cachedResult.headers).forEach(([key, value]) => {
            res.setHeader(key, value);
          });
        }
        
        // Add idempotency headers
        res.setHeader('X-Idempotency-Key', idempotencyKey);
        res.setHeader('X-Idempotency-Cached', 'true');
        res.setHeader('X-Idempotency-Timestamp', cachedResult.timestamp.toISOString());
        
        res.json(cachedResult.data);
        return;
      }

      // Check if operation is already in progress
      const inProgress = await this.idempotencyService.isOperationInProgress(
        idempotencyKey,
        idempotencyRequest,
      );

      if (inProgress) {
        this.logger.warn('Concurrent request with same idempotency key', {
          idempotencyKey,
          method: req.method,
          url: req.url,
        });

        // Return 409 Conflict for concurrent requests
        throw new ConflictException(
          'Операция с данным ключом идемпотентности уже выполняется. Повторите запрос через несколько секунд.'
        );
      }

      // Mark operation as in progress
      await this.idempotencyService.markOperationInProgress(
        idempotencyKey,
        idempotencyRequest,
      );

      this.logger.debug('Processing new idempotent request', {
        idempotencyKey,
        method: req.method,
        url: req.url,
      });

      // Continue to controller
      next();
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      
      this.logger.error('Error in idempotency middleware', {
        idempotencyKey,
        method: req.method,
        url: req.url,
        error: error.message,
      });
      
      // Continue without idempotency on error
      next();
    }
  }

  /**
   * Check if request should be processed for idempotency
   */
  private shouldProcessIdempotency(req: Request): boolean {
    return (
      this.idempotentMethods.has(req.method) &&
      this.idempotentPaths.has(req.path)
    );
  }

  /**
   * Extract idempotency key from request headers
   */
  private extractIdempotencyKey(req: Request): string | null {
    const key = req.headers['idempotency-key'] as string;
    
    if (!key) {
      return null;
    }

    // Validate key format (UUID or similar)
    if (!/^[a-zA-Z0-9\-_]{8,128}$/.test(key)) {
      this.logger.warn('Invalid idempotency key format', {
        key,
        method: req.method,
        url: req.url,
      });
      return null;
    }

    return key;
  }

  /**
   * Extract user ID from request (if authenticated)
   */
  private extractUserId(req: any): string | undefined {
    // Try to get user ID from JWT payload (if available)
    return req.user?.userId || req.user?.sub;
  }

  /**
   * Extract client IP address from request
   */
  private extractClientIp(req: Request): string {
    return req.ip || 
           (req as any).connection?.remoteAddress || 
           (req as any).socket?.remoteAddress ||
           req.headers['x-forwarded-for']?.toString().split(',')[0] ||
           '::1';
  }
}