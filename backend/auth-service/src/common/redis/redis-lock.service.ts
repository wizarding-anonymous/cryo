import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RaceConditionMetricsService, LockAttemptResult } from '../metrics/race-condition-metrics.service';

export interface LockOptions {
  ttlSeconds?: number;
  retryDelayMs?: number;
  maxRetries?: number;
}

@Injectable()
export class RedisLockService {
  private readonly logger = new Logger(RedisLockService.name);
  private readonly lockPrefix = 'auth-service:lock:'; // Префикс для избежания конфликтов с другими сервисами

  constructor(
    private readonly redisService: RedisService,
    private readonly metricsService: RaceConditionMetricsService,
  ) {}

  /**
   * Acquire a distributed lock using Redis SETNX
   * @param lockKey - The key to lock on (will be prefixed with service name)
   * @param options - Lock configuration options
   * @returns Promise<boolean> - true if lock acquired, false otherwise
   */
  async acquireLock(
    lockKey: string,
    options: LockOptions = {}
  ): Promise<boolean> {
    const {
      ttlSeconds = 5,
      retryDelayMs = 100,
      maxRetries = 0
    } = options;

    const fullLockKey = this.lockPrefix + lockKey;
    let attempts = 0;
    const maxAttempts = maxRetries + 1;
    const startTime = Date.now();
    let conflicted = false;
    let timedOut = false;

    while (attempts < maxAttempts) {
      try {
        // Use SETNX (SET if Not eXists) with TTL for atomic lock acquisition
        const lockValue = `${Date.now()}-${Math.random()}`;
        const result = await this.setNX(fullLockKey, lockValue, ttlSeconds);
        
        if (result) {
          const waitTime = Date.now() - startTime;
          this.logger.debug(`Lock acquired: ${fullLockKey} (wait time: ${waitTime}ms)`);
          
          // Record successful lock acquisition
          this.metricsService.recordLockAttempt({
            success: true,
            waitTimeMs: waitTime,
            conflicted,
            timedOut: false,
          });
          
          return true;
        }

        attempts++;
        conflicted = true; // Mark as conflicted since we had to retry
        
        if (attempts < maxAttempts) {
          this.logger.debug(`Lock acquisition failed for ${fullLockKey}, retrying in ${retryDelayMs}ms (attempt ${attempts}/${maxAttempts})`);
          await this.sleep(retryDelayMs);
        }
      } catch (error) {
        this.logger.error(`Error acquiring lock ${fullLockKey}:`, error);
        
        const waitTime = Date.now() - startTime;
        this.metricsService.recordLockAttempt({
          success: false,
          waitTimeMs: waitTime,
          conflicted,
          timedOut: false,
        });
        
        return false;
      }
    }

    const waitTime = Date.now() - startTime;
    timedOut = waitTime > (maxRetries * retryDelayMs + 1000); // Consider timeout if wait time is significantly longer than expected
    
    this.logger.warn(`Failed to acquire lock ${fullLockKey} after ${maxAttempts} attempts (wait time: ${waitTime}ms)`);
    
    // Record failed lock acquisition
    this.metricsService.recordLockAttempt({
      success: false,
      waitTimeMs: waitTime,
      conflicted,
      timedOut,
    });
    
    return false;
  }

  /**
   * Release a distributed lock
   * @param lockKey - The key to release (will be prefixed with service name)
   */
  async releaseLock(lockKey: string): Promise<void> {
    try {
      const fullLockKey = this.lockPrefix + lockKey;
      await this.redisService.delete(fullLockKey);
      this.logger.debug(`Lock released: ${fullLockKey}`);
    } catch (error) {
      this.logger.error(`Error releasing lock ${lockKey}:`, error);
      // Don't throw error on release failure to avoid breaking the flow
    }
  }

  /**
   * Execute a function with a distributed lock
   * @param lockKey - The key to lock on
   * @param fn - The function to execute while holding the lock
   * @param options - Lock configuration options
   * @returns Promise<T> - The result of the function execution
   */
  async withLock<T>(
    lockKey: string,
    fn: () => Promise<T>,
    options: LockOptions = {}
  ): Promise<T> {
    const lockAcquired = await this.acquireLock(lockKey, options);
    
    if (!lockAcquired) {
      throw new Error(`Failed to acquire lock: ${lockKey}`);
    }

    try {
      const result = await fn();
      return result;
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  /**
   * Atomic SET if Not eXists with TTL
   * Uses Redis SETNX command for atomic lock acquisition
   */
  private async setNX(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    try {
      // Use SET with NX (only set if key doesn't exist) and EX (set expiry)
      const result = await this.redisService.setNX(key, value, ttlSeconds);
      return result === 'OK';
    } catch (error) {
      this.logger.error(`SETNX operation failed for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if a lock exists
   * @param lockKey - The key to check (will be prefixed with service name)
   * @returns Promise<boolean> - true if lock exists, false otherwise
   */
  async isLocked(lockKey: string): Promise<boolean> {
    try {
      const fullLockKey = this.lockPrefix + lockKey;
      const value = await this.redisService.get(fullLockKey);
      return value !== null;
    } catch (error) {
      this.logger.error(`Error checking lock ${lockKey}:`, error);
      return false;
    }
  }

  /**
   * Get lock TTL (time to live) in seconds
   * @param lockKey - The key to check (will be prefixed with service name)
   * @returns Promise<number> - TTL in seconds, -1 if no TTL, -2 if key doesn't exist
   */
  async getLockTTL(lockKey: string): Promise<number> {
    try {
      const fullLockKey = this.lockPrefix + lockKey;
      return await this.redisService.getTTL(fullLockKey);
    } catch (error) {
      this.logger.error(`Error getting TTL for lock ${lockKey}:`, error);
      return -2; // Key doesn't exist
    }
  }

  /**
   * Force release a lock (use with caution)
   * This should only be used in emergency situations or cleanup operations
   * @param lockKey - The key to force release (will be prefixed with service name)
   */
  async forceReleaseLock(lockKey: string): Promise<void> {
    const fullLockKey = this.lockPrefix + lockKey;
    this.logger.warn(`Force releasing lock: ${fullLockKey}`);
    await this.releaseLock(lockKey);
  }
}