import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, map } from 'rxjs';
import { UserSearchResultDto } from '../friends/dto/user-search-result.dto';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class UserServiceClient {
  // This would typically come from a config service or environment variables
  private readonly baseUrl = 'http://user-service:3001/api';

  constructor(
    private readonly httpService: HttpService,
    private readonly cacheService: CacheService,
  ) {}

  private async requestWithRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 200): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt === attempts) break;
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }

  async getUsersByIds(ids: string[]): Promise<any[]> {
    if (ids.length === 0) {
      return [];
    }
    const cacheKey = `user_client:batch:${ids.sort().join(',')}`;
    const cached = await this.cacheService.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await this.requestWithRetry(async () =>
      firstValueFrom(
        this.httpService
          .get(`${this.baseUrl}/users/batch`, {
            params: { ids: ids.join(',') },
            timeout: 5000,
          })
          .pipe(map((res) => res.data)),
      ),
    );

    const users = response.users ?? [];
    await this.cacheService.set(cacheKey, users, 60);
    return users;
  }

  async checkUserExists(userId: string): Promise<boolean> {
    const cacheKey = `user_client:exists:${userId}`;
    const cached = await this.cacheService.get<boolean>(cacheKey);
    if (typeof cached === 'boolean') {
      return cached;
    }

    const response = await this.requestWithRetry(async () =>
      firstValueFrom(
        this.httpService
          .get(`${this.baseUrl}/users/${userId}/exists`, { timeout: 3000 })
          .pipe(map((res) => res.data)),
      ),
    );
    const exists = Boolean(response.exists);
    await this.cacheService.set(cacheKey, exists, 300);
    return exists;
  }

  async searchUsers(
    query: string,
    excludeId?: string,
  ): Promise<UserSearchResultDto[]> {
    const cacheKey = `user_client:search:q=${encodeURIComponent(query)}:exclude=${excludeId ?? ''}`;
    const cached = await this.cacheService.get<UserSearchResultDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await this.requestWithRetry(async () =>
      firstValueFrom(
        this.httpService
          .get(`${this.baseUrl}/users/search`, {
            params: { q: query, excludeId },
            timeout: 5000,
          })
          .pipe(map((res) => res.data)),
      ),
    );

    await this.cacheService.set(cacheKey, response, 60);
    return response;
  }
}
