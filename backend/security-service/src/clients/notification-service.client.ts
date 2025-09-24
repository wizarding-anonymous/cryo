import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';

export interface NotificationPayload {
  userId: string;
  type: 'security_alert' | 'account_warning';
  title: string;
  message: string;
  channels?: ('in_app' | 'email')[];
}

@Injectable()
export class NotificationServiceClient {
  private readonly baseUrl?: string;
  private readonly apiKey?: string;

  constructor(
    private readonly config: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: Logger,
  ) {
    this.baseUrl = this.config.get<string>('NOTIFICATION_SERVICE_URL');
    this.apiKey = this.config.get<string>('NOTIFICATION_SERVICE_API_KEY');
  }

  private get headers() {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) h['x-api-key'] = this.apiKey;
    return h;
  }

  async sendNotification(payload: NotificationPayload): Promise<void> {
    if (!this.baseUrl) {
      this.logger.warn(
        'NotificationServiceClient.sendNotification skipped: NOTIFICATION_SERVICE_URL not set',
      );
      return;
    }
    try {
      const resp = await fetch(`${this.baseUrl}/api/notifications`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        this.logger.error('NotificationServiceClient.sendNotification failed', {
          status: resp.status,
          body: await resp.text(),
        });
      }
    } catch (e) {
      this.logger.error('NotificationServiceClient.sendNotification failed', {
        error: (e as Error).message,
      });
    }
  }
}
