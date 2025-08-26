import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';

interface ImportResult {
    gamesImported: number;
    achievementsImported: number;
    profileUpdated: boolean;
    importedAt: Date;
}

@Injectable()
export class MockExternalIntegrationService {
  private readonly logger = new Logger(MockExternalIntegrationService.name);

  constructor(private readonly circuitBreakerService: CircuitBreakerService) {
    this.circuitBreakerService.createBreaker(
      'steam-api',
      this.callSteamApi.bind(this),
    );
    this.circuitBreakerService.createBreaker(
      'epic-api',
      this.callEpicApi.bind(this),
    );
  }

  // This is the function that would actually call the external API
  private async callSteamApi(steamId: string): Promise<any> {
    this.logger.log(`-- Calling actual Steam API for ${steamId} --`);
    // Simulate a call that might fail
    if (Math.random() < 0.3) { // 30% chance of failure
        throw new Error("Steam API timeout");
    }
    return { games: [], achievements: [] };
  }

  private async callEpicApi(epicId: string): Promise<any> {
    this.logger.log(`-- Calling actual Epic API for ${epicId} --`);
    return { games: [] };
  }

  async importFromSteam(userId: string, steamId: string): Promise<ImportResult> {
    this.logger.log(`🎮 Preparing to import Steam data for user ${userId}`);
    try {
      const steamData = await this.circuitBreakerService.getBreaker('steam-api').fire(steamId);
      this.logger.log(`🔄 Mapping games to platform catalog...`);
      return {
        gamesImported: Math.floor(Math.random() * 100),
        achievementsImported: Math.floor(Math.random() * 500),
        profileUpdated: true,
        importedAt: new Date()
      };
    } catch (error) {
        this.logger.error(`Steam import failed for user ${userId}: ${error.message}`);
        throw new ServiceUnavailableException('Steam service is temporarily unavailable.');
    }
  }

  async importFromEpicGames(userId: string, epicId: string): Promise<ImportResult> {
    this.logger.log(`🎮 Preparing to import Epic Games data for user ${userId}`);
    try {
        await this.circuitBreakerService.getBreaker('epic-api').fire(epicId);
        return {
            gamesImported: Math.floor(Math.random() * 50),
            achievementsImported: 0,
            profileUpdated: false,
            importedAt: new Date()
        };
    } catch (error) {
        this.logger.error(`Epic Games import failed for user ${userId}: ${error.message}`);
        throw new ServiceUnavailableException('Epic Games service is temporarily unavailable.');
    }
  }
}
