import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  private defaultConfig: RateLimitConfig = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  };

  async use(req: Request, res: Response, next: NextFunction) {
    const config = this.getConfigForRoute(req.path);
    const key = this.generateKey(req, config);
    
    try {
      const current = await this.redis.incr(key);
      
      if (current === 1) {
        // First request in window, set expiration
        await this.redis.expire(key, Math.ceil(config.windowMs / 1000));
      }
      
      if (current > config.maxRequests) {
        const ttl = await this.redis.ttl(key);
        
        res.set({
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(Date.now() + ttl * 1000).toISOString(),
          'Retry-After': ttl.toString(),
        });
        
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests',
            error: 'Rate limit exceeded',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      
      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, config.maxRequests - current).toString(),
      });
      
      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      // If Redis is down, allow the request but log the error
      console.error('Rate limiting error:', error);
      next();
    }
  }

  private getConfigForRoute(path: string): RateLimitConfig {
    // Special rate limiting for Developer Portal Service integration endpoints
    if (path.includes('/api/v1/developers/') && path.includes('/basic-profile')) {
      return {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 200, // Higher limit for integration endpoints
      };
    }
    
    if (path.includes('/api/v1/publishers/') && path.includes('/basic-profile')) {
      return {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 200, // Higher limit for integration endpoints
      };
    }
    
    return this.defaultConfig;
  }

  private generateKey(req: Request, config: RateLimitConfig): string {
    if (config.keyGenerator) {
      return config.keyGenerator(req);
    }
    
    // Use IP address and user agent for basic rate limiting
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const route = req.route?.path || req.path;
    
    // For Developer Portal Service, we might want to use API key instead
    const apiKey = req.get('X-API-Key');
    if (apiKey && (route.includes('developers') || route.includes('publishers'))) {
      return `rate_limit:api_key:${apiKey}:${route}`;
    }
    
    return `rate_limit:${ip}:${userAgent}:${route}`;
  }
}