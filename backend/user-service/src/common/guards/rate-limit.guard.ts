import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import Redis from 'ioredis';
import { Inject } from '@nestjs/common';

export enum RateLimitType {
  DEFAULT = 'default',
  BATCH = 'batch',
  PROFILE = 'profile',
  INTERNAL = 'internal',
  UPLOAD = 'upload',
  SEARCH = 'search',
}

export interface RateLimitConfig {
  type: RateLimitType;
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  message?: string;
}

export const RATE_LIMIT_KEY = 'rate_limit';

export const RateLimit = (config: Partial<RateLimitConfig>) => {
  return (
    target: any,
    _propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ): any => {
    if (descriptor) {
      Reflect.defineMetadata(RATE_LIMIT_KEY, config, descriptor.value);
      return descriptor;
    } else {
      Reflect.defineMetadata(RATE_LIMIT_KEY, config, target);
      return target;
    }
  };
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly defaultConfigs: Record<RateLimitType, RateLimitConfig>;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {
    this.defaultConfigs = {
      [RateLimitType.DEFAULT]: {
        type: RateLimitType.DEFAULT,
        windowMs: 60 * 1000,
        maxRequests: 60,
        message: 'Too many requests, please try again later',
      },
      [RateLimitType.BATCH]: {
        type: RateLimitType.BATCH,
        windowMs: 5 * 60 * 1000,
        maxRequests: 10,
        message: 'Too many batch operations, please try again later',
      },
      [RateLimitType.PROFILE]: {
        type: RateLimitType.PROFILE,
        windowMs: 60 * 1000,
        maxRequests: 30,
        message: 'Too many profile operations, please try again later',
      },
      [RateLimitType.INTERNAL]: {
        type: RateLimitType.INTERNAL,
        windowMs: 60 * 1000,
        maxRequests: 1000,
        message: 'Too many internal requests, please try again later',
      },
      [RateLimitType.UPLOAD]: {
        type: RateLimitType.UPLOAD,
        windowMs: 60 * 1000,
        maxRequests: 5,
        message: 'Too many upload operations, please try again later',
      },
      [RateLimitType.SEARCH]: {
        type: RateLimitType.SEARCH,
        windowMs: 60 * 1000,
        maxRequests: 100,
        message: 'Too many search requests, please try again later',
      },
    };

    this.logger.log(
      'RateLimitGuard initialized with distributed Redis backend',
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest<Request>();

      const rateLimitEnabled = this.configService.get<boolean>(
        'RATE_LIMIT_ENABLED',
        true,
      );
      if (!rateLimitEnabled) {
        this.logger.debug('Rate limiting is disabled');
        return true;
      }

      const isDockerHealthEndpoint = request.path.includes('/health/docker');
      if (isDockerHealthEndpoint) {
        return this.checkDockerHealthRateLimit(request);
      }

      const endpointConfig = this.reflector.get<Partial<RateLimitConfig>>(
        RATE_LIMIT_KEY,
        context.getHandler(),
      );

      const operationType = this.determineOperationType(
        request,
        endpointConfig,
      );
      const config = this.mergeConfigs(operationType, endpointConfig);
      const key = this.generateKey(request, config);
      const allowed = await this.checkRateLimit(key, config);

      if (!allowed) {
        this.logger.warn(
          `Rate limit exceeded for key: ${key}, type: ${config.type}, IP: ${this.getClientIP(request)}`,
        );

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: config.message,
            error: 'Too Many Requests',
            type: config.type,
            retryAfter: Math.ceil(config.windowMs / 1000),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      this.logger.debug(
        `Rate limit check passed for key: ${key}, type: ${config.type}`,
      );
      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Error in RateLimitGuard', error);
      this.logger.warn(
        'Rate limiting failed, allowing request (fail-open mode)',
      );
      return true;
    }
  }

  private determineOperationType(
    request: Request,
    endpointConfig?: Partial<RateLimitConfig>,
  ): RateLimitType {
    if (endpointConfig?.type) {
      return endpointConfig.type;
    }

    const path = request.path.toLowerCase();

    if (path.includes('/batch/')) {
      return RateLimitType.BATCH;
    }

    if (path.includes('/profile/') || path.includes('/avatar')) {
      return RateLimitType.PROFILE;
    }

    if (path.includes('/internal/')) {
      return RateLimitType.INTERNAL;
    }

    if (request.method === 'POST' && path.includes('/upload')) {
      return RateLimitType.UPLOAD;
    }

    if (
      request.method === 'GET' &&
      (path.includes('/search') || request.query.search)
    ) {
      return RateLimitType.SEARCH;
    }

    return RateLimitType.DEFAULT;
  }

  private mergeConfigs(
    operationType: RateLimitType,
    endpointConfig?: Partial<RateLimitConfig>,
  ): RateLimitConfig {
    const defaultConfig = this.defaultConfigs[operationType];

    return {
      ...defaultConfig,
      ...endpointConfig,
      type: operationType,
    };
  }

  private generateKey(request: Request, config: RateLimitConfig): string {
    if (config.keyGenerator) {
      return config.keyGenerator(request);
    }

    const clientIP = this.getClientIP(request);
    const userId = ((request as any).user?.id as string) || 'anonymous';
    const baseKey = `user-service:rate_limit:${config.type}:${clientIP}:${userId}`;

    if (config.type === RateLimitType.BATCH) {
      const batchSize = this.getBatchSize(request);
      return `${baseKey}:batch_size_${batchSize}`;
    }

    if (config.type === RateLimitType.UPLOAD) {
      const contentLength = request.headers['content-length'] || '0';
      return `${baseKey}:size_${contentLength}`;
    }

    return baseKey;
  }

  private async checkRateLimit(
    key: string,
    config: RateLimitConfig,
  ): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      // Check if Redis client is available and ready
      if (!this.redis) {
        this.logger.warn(
          'Redis client not available, allowing request (fail-open)',
        );
        return true;
      }

      // Additional safety check for pipeline method
      if (typeof this.redis.pipeline !== 'function') {
        this.logger.warn(
          'Redis pipeline method not available, allowing request (fail-open)',
        );
        return true;
      }

      const pipeline = this.redis.pipeline();

      // Ensure pipeline is valid before using
      if (!pipeline) {
        this.logger.warn(
          'Redis pipeline creation failed, allowing request (fail-open)',
        );
        return true;
      }

      pipeline.zremrangebyscore(key, 0, windowStart);
      pipeline.zadd(key, now, `${now}-${Math.random()}`);
      pipeline.zcard(key);
      pipeline.expire(key, Math.ceil(config.windowMs / 1000) + 1);

      const results = await pipeline.exec();

      if (!results || !Array.isArray(results) || results.length < 3) {
        throw new Error(
          'Redis pipeline execution failed or returned invalid results',
        );
      }

      const requestCount = results[2][1] as number;

      this.logger.debug(
        `Rate limit check: ${requestCount}/${config.maxRequests} for key: ${key}`,
      );

      return requestCount <= config.maxRequests;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Redis error in rate limiting: ${errorMessage}`);
      // Fail-open: allow request when Redis is unavailable
      return true;
    }
  }

  private getBatchSize(request: Request): number {
    try {
      if (request.method === 'POST' && request.body) {
        const body = request.body as Record<string, any>;
        if (Array.isArray(body.users)) {
          return body.users.length;
        }
        if (Array.isArray(body.ids)) {
          return body.ids.length;
        }
      }

      if (request.method === 'GET' && request.query.ids) {
        const queryIds = request.query.ids;
        const ids = Array.isArray(queryIds)
          ? queryIds
          : String(queryIds).split(',');
        return ids.length;
      }

      return 1;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(`Error determining batch size: ${errorMessage}`);
      return 1;
    }
  }

  private async checkDockerHealthRateLimit(request: Request): Promise<boolean> {
    const clientIP = this.getClientIP(request);
    const key = `user-service:rate_limit:docker_health:${clientIP}`;

    const config: RateLimitConfig = {
      type: RateLimitType.DEFAULT,
      windowMs: 60 * 1000,
      maxRequests: 120,
      message: 'Too many health check requests',
    };

    try {
      const allowed = await this.checkRateLimit(key, config);

      if (!allowed) {
        this.logger.warn(
          `Docker health check rate limit exceeded for IP: ${clientIP}`,
        );
        return false;
      }

      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error checking Docker health rate limit: ${errorMessage}`,
      );
      return true;
    }
  }

  private getClientIP(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'] as string;
    const realIP = request.headers['x-real-ip'] as string;
    const remoteAddress = request.socket?.remoteAddress;

    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    if (realIP) {
      return realIP;
    }

    return remoteAddress || 'unknown';
  }
}
