import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CircuitBreakerOptions {
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
  rollingCountTimeout: number;
  rollingCountBuckets: number;
  volumeThreshold: number;
  name?: string;
}

@Injectable()
export class CircuitBreakerConfig {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Get default circuit breaker configuration
   */
  getDefaultConfig(): CircuitBreakerOptions {
    return {
      timeout: this.configService.get<number>('CIRCUIT_BREAKER_TIMEOUT', 3000),
      errorThresholdPercentage: this.configService.get<number>('CIRCUIT_BREAKER_ERROR_THRESHOLD', 50),
      resetTimeout: this.configService.get<number>('CIRCUIT_BREAKER_RESET_TIMEOUT', 30000),
      rollingCountTimeout: this.configService.get<number>('CIRCUIT_BREAKER_ROLLING_TIMEOUT', 10000),
      rollingCountBuckets: this.configService.get<number>('CIRCUIT_BREAKER_ROLLING_BUCKETS', 10),
      volumeThreshold: this.configService.get<number>('CIRCUIT_BREAKER_VOLUME_THRESHOLD', 10),
    };
  }

  /**
   * Get circuit breaker configuration for User Service
   */
  getUserServiceConfig(): CircuitBreakerOptions {
    return {
      ...this.getDefaultConfig(),
      name: 'UserService',
      timeout: this.configService.get<number>('USER_SERVICE_CIRCUIT_BREAKER_TIMEOUT', 3000),
      errorThresholdPercentage: this.configService.get<number>('USER_SERVICE_CIRCUIT_BREAKER_ERROR_THRESHOLD', 50),
      resetTimeout: this.configService.get<number>('USER_SERVICE_CIRCUIT_BREAKER_RESET_TIMEOUT', 30000),
    };
  }

  /**
   * Get circuit breaker configuration for Security Service
   */
  getSecurityServiceConfig(): CircuitBreakerOptions {
    return {
      ...this.getDefaultConfig(),
      name: 'SecurityService',
      timeout: this.configService.get<number>('SECURITY_SERVICE_CIRCUIT_BREAKER_TIMEOUT', 5000),
      errorThresholdPercentage: this.configService.get<number>('SECURITY_SERVICE_CIRCUIT_BREAKER_ERROR_THRESHOLD', 60),
      resetTimeout: this.configService.get<number>('SECURITY_SERVICE_CIRCUIT_BREAKER_RESET_TIMEOUT', 60000),
      volumeThreshold: this.configService.get<number>('SECURITY_SERVICE_CIRCUIT_BREAKER_VOLUME_THRESHOLD', 5),
    };
  }

  /**
   * Get circuit breaker configuration for Notification Service
   */
  getNotificationServiceConfig(): CircuitBreakerOptions {
    return {
      ...this.getDefaultConfig(),
      name: 'NotificationService',
      timeout: this.configService.get<number>('NOTIFICATION_SERVICE_CIRCUIT_BREAKER_TIMEOUT', 5000),
      errorThresholdPercentage: this.configService.get<number>('NOTIFICATION_SERVICE_CIRCUIT_BREAKER_ERROR_THRESHOLD', 70),
      resetTimeout: this.configService.get<number>('NOTIFICATION_SERVICE_CIRCUIT_BREAKER_RESET_TIMEOUT', 60000),
      volumeThreshold: this.configService.get<number>('NOTIFICATION_SERVICE_CIRCUIT_BREAKER_VOLUME_THRESHOLD', 3),
    };
  }
}