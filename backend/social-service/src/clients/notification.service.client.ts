import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

// A basic DTO for sending a notification, based on the integration map
interface SendNotificationDto {
  userId: string;
  type: 'friend_request' | 'new_message' | 'achievement_unlocked';
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class NotificationServiceClient {
  private readonly baseUrl = 'http://notification-service:3003/api';

  constructor(private readonly httpService: HttpService) {}

  async sendNotification(dto: SendNotificationDto): Promise<void> {
    // The integration map shows a POST /api/notifications endpoint
    // It also mentions webhooks, but for direct calls, a simple POST is likely.
    await firstValueFrom(
      this.httpService.post(`${this.baseUrl}/notifications`, dto),
    );
  }
}
