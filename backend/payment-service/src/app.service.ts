import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Payment Service for Russian Gaming Platform MVP is running!';
  }
}