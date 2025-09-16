import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';

export interface UserSecurityInfo {
  exists?: boolean;
  locked?: boolean;
  flagged?: boolean;
}

@Injectable()
export class UserServiceClient {
  private readonly baseUrl?: string;
  private readonly apiKey?: string;

  constructor(
    private readonly config: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: Logger,
  ) {
    this.baseUrl = this.config.get<string>('USER_SERVICE_URL');
    this.apiKey = this.config.get<string>('USER_SERVICE_API_KEY');
  }

  private get headers() {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) h['x-api-key'] = this.apiKey;
    return h;
  }

  async getUserExists(userId: string): Promise<boolean | undefined> {
    if (!this.baseUrl) return undefined;
    try {
      const resp = await fetch(`${this.baseUrl}/api/users/${userId}/exists`, { headers: this.headers });
      if (!resp.ok) return undefined;
      const data = (await resp.json()) as { exists?: boolean };
      return data?.exists;
    } catch (e) {
      this.logger.warn('UserServiceClient.getUserExists failed', { userId, error: (e as Error).message });
      return undefined;
    }
  }

  async getUserSecurityInfo(userId: string): Promise<UserSecurityInfo | undefined> {
    if (!this.baseUrl) return undefined;
    try {
      const resp = await fetch(`${this.baseUrl}/api/users/${userId}/security-info`, { headers: this.headers });
      if (!resp.ok) return undefined;
      const data = (await resp.json()) as UserSecurityInfo;
      return data;
    } catch (e) {
      this.logger.warn('UserServiceClient.getUserSecurityInfo failed', { userId, error: (e as Error).message });
      return undefined;
    }
  }
}

