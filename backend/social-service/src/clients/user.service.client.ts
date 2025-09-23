import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, map, timeout, catchError } from 'rxjs';
import { UserSearchResultDto } from '../friends/dto/user-search-result.dto';
import { CacheService } from '../cache/cache.service';
import { AxiosError } from 'axios';

interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
}

@Injectable()
export class UserServiceClient {
  private readonly logger = new Logger(UserServiceClient.name);
  private readonly baseUrl = process.env.USER_SERVICE_URL || 'http://user-service:3001/api';
  private readonly defaultRetryOptions: RetryOptions = {
    attempts: 3,
    baseDelayMs: 200,
    maxDelayMs: 5000,
    timeoutMs: 10000,
  };

  constructor(
    private readonly httpService: HttpService,
    private readonly cacheService: CacheService,
  ) {}

  private async requestWithRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const { attempts, baseDelayMs, maxDelayMs, timeoutMs } = {
      ...this.defaultRetryOptions,
      ...options,
    };

    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts!; attempt++) {
      try {
        this.logger.debug(`Attempt ${attempt}/${attempts} for external service call`);

        const result = await Promise.race([
          fn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), timeoutMs!),
          ),
        ]);

        if (attempt > 1) {
          this.logger.log(`Request succeeded on attempt ${attempt}`);
        }

        return result;
      } catch (error) {
        lastError = error;

        // Don't retry on client errors (4xx)
        if (this.isClientError(error)) {
          this.logger.warn(`Client error, not retrying: ${this.getErrorMessage(error)}`);
          throw error;
        }

        if (attempt === attempts!) {
          this.logger.error(
            `All ${attempts} attempts failed. Last error: ${this.getErrorMessage(error)}`,
          );
          break;
        }

        const delay = Math.min(baseDelayMs! * Math.pow(2, attempt - 1), maxDelayMs!);
        this.logger.warn(
          `Attempt ${attempt} failed, retrying in ${delay}ms: ${this.getErrorMessage(error)}`,
        );

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private isClientError(error: unknown): boolean {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      return typeof status === 'number' && status >= 400 && status < 500;
    }
    return false;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getUsersByIds(ids: string[]): Promise<any[]> {
    if (ids.length === 0) {
      return [];
    }

    // Check cache for individual users first
    const cachedUsers: any[] = [];
    const uncachedIds: string[] = [];

    for (const id of ids) {
      const cached = await this.cacheService.get<any>(`user_client:single:${id}`);
      if (cached) {
        cachedUsers.push(cached);
      } else {
        uncachedIds.push(id);
      }
    }

    if (uncachedIds.length === 0) {
      this.logger.debug(`All ${ids.length} users found in cache`);
      return cachedUsers;
    }

    this.logger.debug(
      `Fetching ${uncachedIds.length} users from service, ${cachedUsers.length} from cache`,
    );

    try {
      const response = await this.requestWithRetry(
        async () =>
          firstValueFrom(
            this.httpService
              .get(`${this.baseUrl}/users/batch`, {
                params: { ids: uncachedIds.join(',') },
              })
              .pipe(
                timeout(8000),
                map((res) => res.data),
                catchError((error) => {
                  this.logger.error(`Failed to fetch users: ${error.message}`);
                  throw error;
                }),
              ),
          ),
        { timeoutMs: 8000 },
      );

      const fetchedUsers = response.users ?? [];

      // Cache individual users
      for (const user of fetchedUsers) {
        await this.cacheService.set(`user_client:single:${user.id}`, user, 300); // 5 minutes
      }

      return [...cachedUsers, ...fetchedUsers];
    } catch (error) {
      this.logger.error(`Failed to fetch users after retries: ${this.getErrorMessage(error)}`);
      // Return cached users even if fetch fails
      return cachedUsers;
    }
  }

  async checkUserExists(userId: string): Promise<boolean> {
    const cacheKey = `user_client:exists:${userId}`;
    const cached = await this.cacheService.get<boolean>(cacheKey);
    if (typeof cached === 'boolean') {
      this.logger.debug(`User existence check for ${userId} found in cache: ${cached}`);
      return cached;
    }

    try {
      const response = await this.requestWithRetry(
        async () =>
          firstValueFrom(
            this.httpService.get(`${this.baseUrl}/users/${userId}/exists`).pipe(
              timeout(5000),
              map((res) => res.data),
              catchError((error) => {
                this.logger.error(`Failed to check user existence: ${error.message}`);
                throw error;
              }),
            ),
          ),
        { timeoutMs: 5000, attempts: 2 }, // Fewer retries for existence checks
      );

      const exists = Boolean(response.exists);
      await this.cacheService.set(cacheKey, exists, 600); // Cache for 10 minutes

      this.logger.debug(`User existence check for ${userId}: ${exists}`);
      return exists;
    } catch (error) {
      this.logger.error(
        `Failed to check user existence for ${userId}: ${this.getErrorMessage(error)}`,
      );
      // Default to true to avoid blocking operations
      return true;
    }
  }

  async searchUsers(query: string, excludeId?: string): Promise<UserSearchResultDto[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    const cacheKey = `user_client:search:q=${encodeURIComponent(normalizedQuery)}:exclude=${excludeId ?? ''}`;

    const cached = await this.cacheService.get<UserSearchResultDto[]>(cacheKey);
    if (cached) {
      this.logger.debug(`Search results for "${normalizedQuery}" found in cache`);
      return cached;
    }

    try {
      const response = await this.requestWithRetry(
        async () =>
          firstValueFrom(
            this.httpService
              .get(`${this.baseUrl}/users/search`, {
                params: { q: normalizedQuery, excludeId },
              })
              .pipe(
                timeout(6000),
                map((res) => res.data),
                catchError((error) => {
                  this.logger.error(`Failed to search users: ${error.message}`);
                  throw error;
                }),
              ),
          ),
        { timeoutMs: 6000 },
      );

      const results = Array.isArray(response) ? response : (response.users ?? []);

      // Cache search results for shorter time since they can change frequently
      await this.cacheService.set(cacheKey, results, 120); // 2 minutes

      this.logger.debug(`Search for "${normalizedQuery}" returned ${results.length} results`);
      return results;
    } catch (error) {
      this.logger.error(
        `Failed to search users for "${normalizedQuery}": ${this.getErrorMessage(error)}`,
      );
      return [];
    }
  }

  /**
   * Get user data with enhanced caching
   */
  async getUserById(userId: string): Promise<any | null> {
    const cacheKey = `user_client:single:${userId}`;
    const cached = await this.cacheService.get<any>(cacheKey);

    if (cached) {
      this.logger.debug(`User ${userId} found in cache`);
      return cached;
    }

    try {
      const response = await this.requestWithRetry(
        async () =>
          firstValueFrom(
            this.httpService.get(`${this.baseUrl}/users/${userId}`).pipe(
              timeout(5000),
              map((res) => res.data),
              catchError((error) => {
                this.logger.error(`Failed to get user ${userId}: ${error.message}`);
                throw error;
              }),
            ),
          ),
        { timeoutMs: 5000 },
      );

      if (response) {
        await this.cacheService.set(cacheKey, response, 300); // 5 minutes
        this.logger.debug(`User ${userId} fetched and cached`);
      }

      return response;
    } catch (error) {
      this.logger.error(`Failed to get user ${userId}: ${this.getErrorMessage(error)}`);
      return null;
    }
  }

  /**
   * Invalidate user cache
   */
  async invalidateUserCache(userId: string): Promise<void> {
    await this.cacheService.del(`user_client:single:${userId}`);
    await this.cacheService.del(`user_client:exists:${userId}`);
    this.logger.debug(`Invalidated cache for user ${userId}`);
  }
}
