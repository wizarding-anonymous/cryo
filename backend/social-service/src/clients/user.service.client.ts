import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, map } from 'rxjs';
import { UserSearchResultDto } from '../friends/dto/user-search-result.dto';

@Injectable()
export class UserServiceClient {
  // This would typically come from a config service or environment variables
  private readonly baseUrl = 'http://user-service:3001/api';

  constructor(private readonly httpService: HttpService) {}

  async getUsersByIds(ids: string[]): Promise<any[]> {
    if (ids.length === 0) {
      return [];
    }
    const response = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/users/batch`, {
        params: { ids: ids.join(',') },
      }).pipe(map(res => res.data)),
    );
    return response.users;
  }

  async checkUserExists(userId: string): Promise<boolean> {
    const response = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/users/${userId}/exists`)
        .pipe(map(res => res.data)),
    );
    return response.exists;
  }

  async searchUsers(query: string, excludeId?: string): Promise<UserSearchResultDto[]> {
    const response = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/users/search`, {
        params: { q: query, excludeId },
      }).pipe(map(res => res.data)),
    );
    return response;
  }
}
