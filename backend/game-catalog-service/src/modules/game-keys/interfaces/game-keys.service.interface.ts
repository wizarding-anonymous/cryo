export interface IGameKeysService {
  activateKey(userId: string, key: string): Promise<ActivationResult>;
}

export interface ActivationResult {
  success: boolean;
  gameId?: string;
  error?: string;
}
