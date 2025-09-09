import { Injectable } from '@nestjs/common';
import { IGameKeysService, ActivationResult } from '../interfaces/game-keys.service.interface';

@Injectable()
export class MockGameKeysService implements IGameKeysService {
  private usedKeys = new Set<string>();
  private readonly validGameId = 'a1b2c3d4-e5f6-7890-1234-567890abcdef';

  async activateKey(userId: string, key: string): Promise<ActivationResult> {
    // 1. Check for special, hardcoded test keys first
    if (key === 'USED-KEY-0000-0000-0000-0000') {
      return { success: false, error: 'This key has already been used.' };
    }
    if (key === 'REGION-LOCKD-KEY-0000-0000-0000') {
        return { success: false, error: 'This key is not available in your region.' };
    }
    if (key === 'GOOD-VALID-KEY-0000-0000-0000') {
        if (this.usedKeys.has(key)) {
            return { success: false, error: 'This key has already been used.' };
        }
        this.usedKeys.add(key);
        console.log(`User ${userId} successfully activated key ${key} for game ${this.validGameId}`);
        return { success: true, gameId: this.validGameId };
    }

    // 2. If not a special key, then apply generic validation
    if (!key || !/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) {
      return { success: false, error: 'Invalid key format.' };
    }

    // 3. Check if a generic key has been used
    if (this.usedKeys.has(key)) {
        return { success: false, error: 'This key has already been used.' };
    }

    // Assume any other key with the correct format is a valid, new key for this mock
    this.usedKeys.add(key);
    console.log(`User ${userId} successfully activated generic key ${key} for game ${this.validGameId}`);
    return { success: true, gameId: this.validGameId };
  }
}
