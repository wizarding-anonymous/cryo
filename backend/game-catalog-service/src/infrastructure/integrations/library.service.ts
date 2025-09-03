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
    ['user-1', ['g1', 'g2']],
    ['user-2', ['g3']],
  ]);

  private ownedEditions: Map<string, string[]> = new Map([
    // Mock data: userId -> array of editionIds
    ['user-1', ['g1-standard', 'g2-deluxe']],
    ['user-2', ['g3-standard']],
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

  /**
   * Gets the editions of a specific game owned by a user.
   * @param userId The ID of the user.
   * @param gameId The ID of the game.
   * @returns A promise that resolves to an array of owned edition IDs for that game.
   */
  async getOwnedEditionsForGame(userId: string, gameId: string): Promise<string[]> {
    console.log(`[Mock Library Service] Getting owned editions for user ${userId}, game ${gameId}`);
    const userEditions = this.ownedEditions.get(userId) || [];
    // In a real service, you'd also check if the edition belongs to the gameId
    return Promise.resolve(userEditions);
  }
}
