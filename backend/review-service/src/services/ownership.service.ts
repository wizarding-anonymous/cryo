import { Injectable, Inject, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { catchError, retry, timeout } from 'rxjs/operators';

export interface OwnershipResponse {
  owned: boolean;
  purchaseDate?: string;
  gameId: string;
  userId: string;
}

export class ExternalServiceError extends Error {
  constructor(
    message: string,
    public readonly service: string,
    public readonly statusCode?: number,
    public readonly originalError?: any,
  ) {
    super(message);
    this.name = 'ExternalServiceError';
  }
}

@Injectable()
export class OwnershipService {
    private readonly logger = new Logger(OwnershipService.name);
    private readonly libraryServiceUrl: string;
    private readonly requestTimeout: number;
    private readonly maxRetries: number;
    private readonly cacheTimeout: number;
    private readonly negativeCacheTimeout: number;

    constructor(
        private readonly httpService: HttpService,
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
        private readonly configService: ConfigService,
    ) {
        this.libraryServiceUrl = this.configService.get<string>('LIBRARY_SERVICE_URL', 'http://library-service:3000');
        this.requestTimeout = this.configService.get<number>('OWNERSHIP_REQUEST_TIMEOUT', 5000);
        this.maxRetries = this.configService.get<number>('OWNERSHIP_MAX_RETRIES', 3);
        this.cacheTimeout = this.configService.get<number>('OWNERSHIP_CACHE_TIMEOUT', 600); // 10 minutes
        this.negativeCacheTimeout = this.configService.get<number>('OWNERSHIP_NEGATIVE_CACHE_TIMEOUT', 300); // 5 minutes
    }

    async checkGameOwnership(userId: string, gameId: string): Promise<boolean> {
        if (!userId || !gameId) {
            throw new Error('userId and gameId are required');
        }

        // Try to get from cache first
        const cacheKey = `ownership_${userId}_${gameId}`;
        const cachedOwnership = await this.getCachedOwnership(cacheKey);

        if (cachedOwnership !== undefined) {
            this.logger.debug(`Cache hit for ownership check: ${cacheKey} = ${cachedOwnership}`);
            return cachedOwnership;
        }

        try {
            const ownsGame = await this.fetchOwnershipFromLibraryService(userId, gameId);
            
            // Cache positive results for longer, negative results for shorter time
            const ttl = ownsGame ? this.cacheTimeout : this.negativeCacheTimeout;
            await this.cacheOwnership(cacheKey, ownsGame, ttl);

            this.logger.debug(`Ownership check completed: user ${userId} ${ownsGame ? 'owns' : 'does not own'} game ${gameId}`);
            return ownsGame;
        } catch (error) {
            this.logger.error(`Failed to check game ownership for user ${userId}, game ${gameId}:`, error);
            
            // For safety, return false if we can't verify ownership
            // Cache negative result for a short time to avoid repeated failures
            await this.cacheOwnership(cacheKey, false, 60); // 1 minute cache for errors
            
            return false;
        }
    }

    private async getCachedOwnership(cacheKey: string): Promise<boolean | undefined> {
        try {
            return await this.cacheManager.get<boolean>(cacheKey);
        } catch (error) {
            this.logger.warn(`Cache get failed for key ${cacheKey}:`, error);
            return undefined;
        }
    }

    private async cacheOwnership(cacheKey: string, ownership: boolean, ttl: number): Promise<void> {
        try {
            await this.cacheManager.set(cacheKey, ownership, ttl);
            this.logger.debug(`Cached ownership result: ${cacheKey} = ${ownership} (TTL: ${ttl}s)`);
        } catch (error) {
            this.logger.warn(`Cache set failed for key ${cacheKey}:`, error);
        }
    }

    private async fetchOwnershipFromLibraryService(userId: string, gameId: string): Promise<boolean> {
        const url = `${this.libraryServiceUrl}/library/user/${userId}/game/${gameId}`;
        
        try {
            this.logger.debug(`Checking ownership via Library Service: ${url}`);
            
            const response = await firstValueFrom(
                this.httpService
                    .get<OwnershipResponse>(url, {
                        headers: {
                            'Content-Type': 'application/json',
                            'User-Agent': 'review-service/1.0',
                        },
                    })
                    .pipe(
                        timeout(this.requestTimeout),
                        retry({
                            count: this.maxRetries,
                            delay: (error, retryCount) => {
                                const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000); // Exponential backoff, max 5s
                                this.logger.warn(`Retry ${retryCount}/${this.maxRetries} for ownership check after ${delay}ms:`, error.message);
                                return new Promise(resolve => setTimeout(resolve, delay));
                            },
                        }),
                        catchError((error) => {
                            // Handle 404 as "user doesn't own the game"
                            if (error.response?.status === 404) {
                                this.logger.debug(`Game ${gameId} not found in user ${userId} library (404)`);
                                return Promise.resolve({
                                    data: { owned: false, gameId, userId },
                                    status: 200,
                                    statusText: 'OK',
                                    headers: {},
                                    config: {} as any,
                                });
                            }
                            
                            // Transform other errors to ExternalServiceError
                            const statusCode = error.response?.status;
                            const message = error.response?.data?.message || error.message || 'Unknown error';
                            
                            throw new ExternalServiceError(
                                `Library Service error: ${message}`,
                                'library-service',
                                statusCode,
                                error,
                            );
                        }),
                    ),
            );

            const ownsGame = response.data?.owned;
            
            // Validate response structure - must be explicitly true or false
            if (ownsGame !== true && ownsGame !== false) {
                this.logger.warn(`Invalid ownership response format from Library Service:`, response.data);
                return false;
            }

            return ownsGame;
        } catch (error) {
            if (error instanceof ExternalServiceError) {
                throw error;
            }
            
            // Handle timeout and other network errors
            const message = error.name === 'TimeoutError' 
                ? `Library Service request timeout after ${this.requestTimeout}ms`
                : `Library Service request failed: ${error.message}`;
                
            throw new ExternalServiceError(
                message,
                'library-service',
                undefined,
                error,
            );
        }
    }

    /**
     * Clear ownership cache for a specific user and game
     */
    async clearOwnershipCache(userId: string, gameId: string): Promise<void> {
        const cacheKey = `ownership_${userId}_${gameId}`;
        try {
            await this.cacheManager.del(cacheKey);
            this.logger.debug(`Cleared ownership cache for key: ${cacheKey}`);
        } catch (error) {
            this.logger.warn(`Failed to clear ownership cache for key ${cacheKey}:`, error);
        }
    }

    /**
     * Clear all ownership cache for a specific user
     */
    async clearUserOwnershipCache(userId: string): Promise<void> {
        // Note: This is a simplified implementation. In production, you might want to use
        // Redis SCAN or maintain a separate index of cache keys per user
        this.logger.debug(`Clearing all ownership cache for user: ${userId}`);
        // Implementation would depend on the cache manager's capabilities
    }

    /**
     * Get service health status
     */
    async getServiceHealth(): Promise<{ status: 'healthy' | 'unhealthy'; libraryService: boolean }> {
        try {
            // Simple health check - try to reach the library service
            const response = await firstValueFrom(
                this.httpService
                    .get(`${this.libraryServiceUrl}/health`, { timeout: 2000 })
                    .pipe(
                        timeout(2000),
                        catchError(() => Promise.resolve({ status: 503 })),
                    ),
            );
            
            const libraryServiceHealthy = response.status === 200;
            
            return {
                status: libraryServiceHealthy ? 'healthy' : 'unhealthy',
                libraryService: libraryServiceHealthy,
            };
        } catch (error) {
            this.logger.warn('Health check failed:', error);
            return {
                status: 'unhealthy',
                libraryService: false,
            };
        }
    }
}