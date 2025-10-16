import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { User } from '../../user/entities/user.entity';

interface AuthServiceConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
}

@Injectable()
export class AuthServiceClient {
  private readonly logger = new Logger(AuthServiceClient.name);
  private readonly config: AuthServiceConfig;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.config = {
      baseUrl: this.configService.get<string>(
        'AUTH_SERVICE_URL',
        'http://auth-service:3001',
      ),
      timeout: this.configService.get<number>('AUTH_SERVICE_TIMEOUT', 5000),
      retries: this.configService.get<number>('AUTH_SERVICE_RETRIES', 3),
    };
  }

  /**
   * Notify Auth Service about user creation
   */
  async notifyUserCreated(user: User): Promise<void> {
    const payload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      event: 'USER_CREATED',
    };

    try {
      this.logger.log(`Notifying Auth Service about user creation: ${user.id}`);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.config.baseUrl}/internal/users/created`,
          payload,
          {
            timeout: this.config.timeout,
            headers: {
              'Content-Type': 'application/json',
              'X-Service-Name': 'user-service',
              'X-Correlation-Id': this.generateCorrelationId(),
            },
          },
        ),
      );

      this.logger.log(
        `Auth Service notified successfully for user: ${user.id}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to notify Auth Service about user creation: ${user.id}`,
        error.message,
      );
      throw new Error(`Auth Service notification failed: ${error.message}`);
    }
  }

  /**
   * Notify Auth Service about user updates
   */
  async notifyUserUpdated(user: User, changes: Partial<User>): Promise<void> {
    const payload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      changes,
      updatedAt: user.updatedAt,
      event: 'USER_UPDATED',
    };

    try {
      this.logger.log(`Notifying Auth Service about user update: ${user.id}`);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.config.baseUrl}/internal/users/updated`,
          payload,
          {
            timeout: this.config.timeout,
            headers: {
              'Content-Type': 'application/json',
              'X-Service-Name': 'user-service',
              'X-Correlation-Id': this.generateCorrelationId(),
            },
          },
        ),
      );

      this.logger.log(
        `Auth Service notified successfully for user update: ${user.id}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to notify Auth Service about user update: ${user.id}`,
        error.message,
      );
      throw new Error(`Auth Service notification failed: ${error.message}`);
    }
  }

  /**
   * Notify Auth Service about user deletion
   */
  async notifyUserDeleted(userId: string): Promise<void> {
    const payload = {
      userId,
      deletedAt: new Date(),
      event: 'USER_DELETED',
    };

    try {
      this.logger.log(`Notifying Auth Service about user deletion: ${userId}`);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.config.baseUrl}/internal/users/deleted`,
          payload,
          {
            timeout: this.config.timeout,
            headers: {
              'Content-Type': 'application/json',
              'X-Service-Name': 'user-service',
              'X-Correlation-Id': this.generateCorrelationId(),
            },
          },
        ),
      );

      this.logger.log(
        `Auth Service notified successfully for user deletion: ${userId}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to notify Auth Service about user deletion: ${userId}`,
        error.message,
      );
      throw new Error(`Auth Service notification failed: ${error.message}`);
    }
  }

  /**
   * Sync user data with Auth Service
   */
  async syncUserData(user: User): Promise<void> {
    const payload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      updatedAt: user.updatedAt,
    };

    try {
      this.logger.log(`Syncing user data with Auth Service: ${user.id}`);

      await firstValueFrom(
        this.httpService.put(
          `${this.config.baseUrl}/internal/users/${user.id}/sync`,
          payload,
          {
            timeout: this.config.timeout,
            headers: {
              'Content-Type': 'application/json',
              'X-Service-Name': 'user-service',
              'X-Correlation-Id': this.generateCorrelationId(),
            },
          },
        ),
      );

      this.logger.log(`User data synced successfully: ${user.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to sync user data with Auth Service: ${user.id}`,
        error.message,
      );
      throw new Error(`Auth Service sync failed: ${error.message}`);
    }
  }

  /**
   * Check if Auth Service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.config.baseUrl}/health`, {
          timeout: 2000, // Shorter timeout for health checks
          headers: {
            'X-Service-Name': 'user-service',
          },
        }),
      );

      return response.status === 200;
    } catch (error) {
      this.logger.warn(`Auth Service health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate correlation ID for request tracing
   */
  private generateCorrelationId(): string {
    return `user-service-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
