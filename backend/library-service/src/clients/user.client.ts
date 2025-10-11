import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, retry, catchError, of, timer } from 'rxjs';

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UserServiceClient {
  private readonly logger = new Logger(UserServiceClient.name);
  private readonly baseUrl: string;
  private readonly retryAttempts = 3;
  private readonly retryDelay = 300;

  // Circuit Breaker configuration
  private readonly circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'CLOSED',
  };
  private readonly failureThreshold = 5;
  private readonly recoveryTimeout = 60000; // 60 seconds
  private readonly halfOpenMaxCalls = 3;
  private halfOpenCalls = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const configuredBaseUrl =
      this.configService.get<string>('USER_SERVICE_URL');
    if (!configuredBaseUrl) {
      throw new Error('User service URL is not configured');
    }
    this.baseUrl = configuredBaseUrl;
  }

  private checkCircuitBreaker(): boolean {
    const now = Date.now();

    switch (this.circuitBreaker.state) {
      case 'OPEN':
        if (now - this.circuitBreaker.lastFailureTime > this.recoveryTimeout) {
          this.circuitBreaker.state = 'HALF_OPEN';
          this.halfOpenCalls = 0;
          this.logger.log('Circuit breaker moved to HALF_OPEN state');
          return true;
        }
        return false;

      case 'HALF_OPEN':
        return this.halfOpenCalls < this.halfOpenMaxCalls;

      case 'CLOSED':
      default:
        return true;
    }
  }

  private onSuccess(): void {
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.state = 'CLOSED';
      this.circuitBreaker.failures = 0;
      this.logger.log('Circuit breaker moved to CLOSED state');
    } else if (this.circuitBreaker.state === 'CLOSED') {
      this.circuitBreaker.failures = 0;
    }
  }

  private onFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.state = 'OPEN';
      this.logger.warn('Circuit breaker moved to OPEN state from HALF_OPEN');
    } else if (this.circuitBreaker.failures >= this.failureThreshold) {
      this.circuitBreaker.state = 'OPEN';
      this.logger.warn(
        `Circuit breaker OPENED after ${this.circuitBreaker.failures} failures`,
      );
    }
  }

  private async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    if (!this.checkCircuitBreaker()) {
      const error = new Error(
        'Circuit breaker is OPEN - User service unavailable',
      );
      this.logger.warn('Request blocked by circuit breaker');
      throw error;
    }

    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.halfOpenCalls++;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  async doesUserExist(userId: string): Promise<boolean> {
    return this.executeWithCircuitBreaker(async () => {
      const url = `${this.baseUrl}/users/${userId}/exists`;

      const request$ = this.httpService.get<{ exists: boolean }>(url).pipe(
        retry({
          count: this.retryAttempts,
          delay: (error, retryCount) => {
            this.logger.warn(
              `Retry attempt ${retryCount} for doesUserExist: ${error.message}`,
            );
            return timer(this.retryDelay * retryCount);
          },
        }),
        catchError((error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Failed to check existence for user ${userId} after ${this.retryAttempts} attempts: ${message}`,
          );
          return of({ data: { exists: false } });
        }),
      );

      const response = await firstValueFrom(request$);
      return response.data.exists === true;
    });
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    return this.executeWithCircuitBreaker(async () => {
      const url = `${this.baseUrl}/users/${userId}`;

      const request$ = this.httpService.get<UserProfile>(url).pipe(
        retry({
          count: this.retryAttempts,
          delay: (error, retryCount) => {
            this.logger.warn(
              `Retry attempt ${retryCount} for getUserProfile: ${error.message}`,
            );
            return timer(this.retryDelay * retryCount);
          },
        }),
        catchError((error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Failed to get user profile for ${userId} after ${this.retryAttempts} attempts: ${message}`,
          );
          return of({ data: null });
        }),
      );

      const response = await firstValueFrom(request$);
      return response.data;
    });
  }

  async validateUserToken(
    token: string,
  ): Promise<{ valid: boolean; userId?: string }> {
    return this.executeWithCircuitBreaker(async () => {
      const url = `${this.baseUrl}/auth/validate`;

      const request$ = this.httpService
        .post<{ valid: boolean; userId?: string }>(
          url,
          { token },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )
        .pipe(
          retry({
            count: this.retryAttempts,
            delay: (error, retryCount) => {
              this.logger.warn(
                `Retry attempt ${retryCount} for validateUserToken: ${error.message}`,
              );
              return timer(this.retryDelay * retryCount);
            },
          }),
          catchError((error: unknown) => {
            const message =
              error instanceof Error ? error.message : String(error);
            this.logger.error(
              `Failed to validate user token after ${this.retryAttempts} attempts: ${message}`,
            );
            return of({ data: { valid: false } });
          }),
        );

      const response = await firstValueFrom(request$);
      return response.data;
    });
  }
}
