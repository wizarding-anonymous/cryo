import { Injectable } from '@nestjs/common';

/**
 * This is a mock client for the Library Service.
 * In a real microservices architecture, this would be a generated client
 * (e.g., from an OpenAPI spec) that makes HTTP or gRPC calls.
 */
@Injectable()
export class LibraryServiceIntegration {
  private ownedGames: Map<string, string[]> = new Map([
    // Mock data: userId -> array of gameIds
    ['user-1', ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12']],
    ['user-2', ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13']],
  ]);

  /**
   * Checks which of the given game IDs are owned by the user.
   * @param userId The ID of the user.
   * @param gameIds An array of game IDs to check.
   * @returns A promise that resolves to an array of game IDs owned by the user.
   */
  async filterOwnedGames(userId: string, gameIds: string[]): Promise<string[]> {
    console.log(`[Mock Library Service] Checking owned games for user ${userId}`);
    const userLibrary = this.ownedGames.get(userId) || [];
    const ownedGameIds = gameIds.filter(id => userLibrary.includes(id));
    return Promise.resolve(ownedGameIds);
  }
}
