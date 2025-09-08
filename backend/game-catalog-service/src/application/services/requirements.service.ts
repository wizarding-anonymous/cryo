import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { SystemRequirements } from '../../domain/entities/system-requirements.entity';

// A mock user configuration for demonstration purposes
interface UserConfig {
    os: string;
    processor: string;
    memory: string; // e.g., "16GB"
}

@Injectable()
export class RequirementsService {
  constructor(private readonly gameRepository: GameRepository) {}

  async getRequirements(gameId: string): Promise<SystemRequirements> {
    const game = await this.gameRepository.findById(gameId);
    if (!game) {
      throw new NotFoundException(`Game with ID "${gameId}" not found`);
    }
    return game.systemRequirements;
  }

  async updateRequirements(
    gameId: string,
    developerId: string,
    requirements: SystemRequirements,
  ): Promise<SystemRequirements> {
    const game = await this.gameRepository.findById(gameId);
    if (!game) {
      throw new NotFoundException(`Game with ID "${gameId}" not found`);
    }
    if (game.developerId !== developerId) {
      throw new ForbiddenException('You do not own this game.');
    }

    game.systemRequirements = requirements;
    const updatedGame = await this.gameRepository.save(game);
    return updatedGame.systemRequirements;
  }

  /**
   * Placeholder for checking user's PC configuration against game's requirements.
   * A real implementation would be more complex, parsing memory values,
   * comparing processor generations, etc.
   */
  async checkCompatibility(gameId: string, userConfig: UserConfig): Promise<{ compatible: boolean; message: string }> {
    const requirements = await this.getRequirements(gameId);
    if (!requirements?.minimum) {
        return { compatible: true, message: 'No minimum requirements specified.' };
    }

    // This is a highly simplified check
    const osMatch = userConfig.os.toLowerCase().includes(requirements.minimum.os.toLowerCase());

    if (osMatch) {
        return { compatible: true, message: 'Your system appears to be compatible.' };
    } else {
        return { compatible: false, message: 'Your OS may not be compatible.' };
    }
  }
}
