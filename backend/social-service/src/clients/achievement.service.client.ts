import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface UpdateProgressDto {
  userId: string;
  eventType: 'friend_added'; // Only event type relevant to Social Service for now
  eventData: {
    friendId: string;
  };
}

@Injectable()
export class AchievementServiceClient {
  private readonly baseUrl =
    process.env.ACHIEVEMENT_SERVICE_URL ||
    'http://achievement-service:3003/api';

  constructor(private readonly httpService: HttpService) {}

  async updateProgress(dto: UpdateProgressDto): Promise<void> {
    await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/achievements/progress/update`,
        dto,
      ),
    );
  }
}
