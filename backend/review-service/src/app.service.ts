import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Review Service API - Ready to serve game reviews and ratings!';
  }

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'review-service',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
