import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Notification Service API - Микросервис уведомлений российской игровой платформы';
  }
}
