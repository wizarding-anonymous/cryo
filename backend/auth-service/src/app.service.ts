import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return '🔐 Auth Service - Authentication and Authorization Microservice for Russian Gaming Platform';
  }
}