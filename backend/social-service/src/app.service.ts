import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Social Service is running!';
  }

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'social-service',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
