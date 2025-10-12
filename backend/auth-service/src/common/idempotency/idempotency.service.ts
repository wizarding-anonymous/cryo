import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '@nestjs/config';

export interface IdempotencyResult {
  statusCode: number;
  data: any;
  timestamp: Date;
  headers?: Record<string, string>;
}

export interface IdempotencyRequest {
  method: string;
  url: string;
  body: any;
  userId?: string;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly ttlSeconds: number;
  private readonly keyPrefix = 'auth-service:idempotency';

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    // Default TTL: 24 hours (86400 seconds)
    this.ttlSeconds = this.configService.get<number>('IDEMPOTENCY_TTL_SECONDS', 86400);
  }

  /**
   * Generate idempotency key from request data
   * Uses service-specific prefix to avoid conflicts in shared Redis
   */
  private generateKey(idempotencyKey: string, request: IdempotencyRequest): string {
    const keyData = {
      service: 'auth-service',
      key: idempotencyKey,
      method: request.method,
      url: request.url,
      userId: request.userId,
      // Include body hash for additional uniqueness
      bodyHash: this.hashObject(request.body),
    };
    
    return `${this.keyPrefix}:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`;
  }

  /**
   * Hash object for consistent key generation
   */
  private hashObject(obj: any): string {
    if (!obj) return '';
    
    try {
      const crypto = require('crypto');
      const str = JSON.stringify(obj, Object.keys(obj).sort());
      return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
    } catch (error) {
      this.logger.warn('Failed to hash object for idempotency key', { error: error.message });
      return '';
    }
  }

  /**
   * Store operation result for idempotency
   */
  async storeResult(
    idempotencyKey: string,
    request: IdempotencyRequest,
    result: IdempotencyResult,
  ): Promise<void> {
    try {
      const key = this.generateKey(idempotencyKey, request);
      const data = {
        ...result,
        timestamp: result.timestamp.toISOString(),
        request: {
          method: request.method,
          url: request.url,
          userId: request.userId,
        },
      };

      await this.redisService.set(key, JSON.stringify(data), this.ttlSeconds);
      
      this.logger.debug('Stored idempotency result', {
        idempotencyKey,
        key,
        statusCode: result.statusCode,
        ttl: this.ttlSeconds,
      });
    } catch (error) {
      this.logger.error('Failed to store idempotency result', {
        idempotencyKey,
        error: error.message,
      });
      // Don't throw - idempotency is a performance optimization, not critical
    }
  }

  /**
   * Retrieve stored operation result
   */
  async getResult(
    idempotencyKey: string,
    request: IdempotencyRequest,
  ): Promise<IdempotencyResult | null> {
    try {
      const key = this.generateKey(idempotencyKey, request);
      const data = await this.redisService.get(key);
      
      if (!data) {
        this.logger.debug('No idempotency result found', { idempotencyKey, key });
        return null;
      }

      const parsed = JSON.parse(data);
      const result: IdempotencyResult = {
        ...parsed,
        timestamp: new Date(parsed.timestamp),
      };

      this.logger.debug('Retrieved idempotency result', {
        idempotencyKey,
        key,
        statusCode: result.statusCode,
        age: Date.now() - result.timestamp.getTime(),
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to retrieve idempotency result', {
        idempotencyKey,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Check if operation is in progress (for concurrent requests with same key)
   */
  async isOperationInProgress(
    idempotencyKey: string,
    request: IdempotencyRequest,
  ): Promise<boolean> {
    try {
      const progressKey = `${this.generateKey(idempotencyKey, request)}:progress`;
      const inProgress = await this.redisService.get(progressKey);
      return inProgress === 'true';
    } catch (error) {
      this.logger.error('Failed to check operation progress', {
        idempotencyKey,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Mark operation as in progress
   */
  async markOperationInProgress(
    idempotencyKey: string,
    request: IdempotencyRequest,
  ): Promise<void> {
    try {
      const progressKey = `${this.generateKey(idempotencyKey, request)}:progress`;
      // Set with shorter TTL (5 minutes) to prevent stuck operations
      await this.redisService.set(progressKey, 'true', 300);
      
      this.logger.debug('Marked operation as in progress', {
        idempotencyKey,
        progressKey,
      });
    } catch (error) {
      this.logger.error('Failed to mark operation in progress', {
        idempotencyKey,
        error: error.message,
      });
    }
  }

  /**
   * Clear operation progress marker
   */
  async clearOperationProgress(
    idempotencyKey: string,
    request: IdempotencyRequest,
  ): Promise<void> {
    try {
      const progressKey = `${this.generateKey(idempotencyKey, request)}:progress`;
      await this.redisService.delete(progressKey);
      
      this.logger.debug('Cleared operation progress', {
        idempotencyKey,
        progressKey,
      });
    } catch (error) {
      this.logger.error('Failed to clear operation progress', {
        idempotencyKey,
        error: error.message,
      });
    }
  }

  /**
   * Delete stored idempotency result (for testing or cleanup)
   */
  async deleteResult(
    idempotencyKey: string,
    request: IdempotencyRequest,
  ): Promise<void> {
    try {
      const key = this.generateKey(idempotencyKey, request);
      const progressKey = `${key}:progress`;
      
      await Promise.all([
        this.redisService.delete(key),
        this.redisService.delete(progressKey),
      ]);
      
      this.logger.debug('Deleted idempotency result', { idempotencyKey, key });
    } catch (error) {
      this.logger.error('Failed to delete idempotency result', {
        idempotencyKey,
        error: error.message,
      });
    }
  }

  /**
   * Get idempotency statistics for monitoring
   */
  async getStats(): Promise<{
    totalKeys: number;
    progressKeys: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  }> {
    try {
      const pattern = `${this.keyPrefix}:*`;
      const keys = await this.redisService.keys(pattern);
      
      const progressKeys = keys.filter(key => key.endsWith(':progress'));
      const resultKeys = keys.filter(key => !key.endsWith(':progress'));
      
      let oldestEntry: Date | undefined;
      let newestEntry: Date | undefined;
      
      if (resultKeys.length > 0) {
        // Sample a few keys to get timestamp range
        const sampleKeys = resultKeys.slice(0, Math.min(10, resultKeys.length));
        const timestamps: Date[] = [];
        
        for (const key of sampleKeys) {
          try {
            const data = await this.redisService.get(key);
            if (data) {
              const parsed = JSON.parse(data);
              timestamps.push(new Date(parsed.timestamp));
            }
          } catch (error) {
            // Skip invalid entries
          }
        }
        
        if (timestamps.length > 0) {
          timestamps.sort((a, b) => a.getTime() - b.getTime());
          oldestEntry = timestamps[0];
          newestEntry = timestamps[timestamps.length - 1];
        }
      }
      
      return {
        totalKeys: resultKeys.length,
        progressKeys: progressKeys.length,
        oldestEntry,
        newestEntry,
      };
    } catch (error) {
      this.logger.error('Failed to get idempotency stats', { error: error.message });
      return {
        totalKeys: 0,
        progressKeys: 0,
      };
    }
  }


}