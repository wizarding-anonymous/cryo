import { Injectable } from '@nestjs/common';

export interface UserPreferences {
  favoriteTags: string[];
  favoriteCategories: string[];
}

/**
 * This is a mock client for a User Preference Service.
 * In a real microservices architecture, this would fetch data from the User Service
 * or a dedicated AI/Analytics service.
 */
@Injectable()
export class UserPreferenceServiceIntegration {
  private userPreferences: Map<string, UserPreferences> = new Map([
    // Mock data: userId -> preferences
    ['user-1', { favoriteTags: ['tag-a', 'tag-b'], favoriteCategories: ['cat-1'] }],
    ['user-2', { favoriteTags: ['tag-c'], favoriteCategories: ['cat-2', 'cat-3'] }],
  ]);

  async getPreferences(userId: string): Promise<UserPreferences | null> {
    console.log(`[Mock User Preference Service] Getting preferences for user ${userId}`);
    const prefs = this.userPreferences.get(userId);
    return Promise.resolve(prefs || { favoriteTags: [], favoriteCategories: [] });
  }
}
