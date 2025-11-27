import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout, retry, catchError } from 'rxjs';
import { AxiosError } from 'axios';

export interface ValidateTokenRequest {
  token: string;
  requiredPermissions?: string[];
}

export interface ValidateTokenResponse {
  valid: boolean;
  user?: {
    id: string;
    email: string;
    username: string;
    roles: string[];
    permissions: string[];
  };
  error?: string;
}

export interface InternalServiceAuthRequest {
  serviceId: string;
  targetService: string;
  action: string;
}

export interface InternalServiceAuthResponse {
  authorized: boolean;
  serviceInfo?: {
    id: string;
    name: string;
    permissions: string[];
  };
  error?: string;
}

@Injectable()
export class AuthServiceClient {
  private readonly logger = new Logger(AuthServiceClient.name);
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retryAttempts: number;
  private readonly internalServiceKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'auth.service.url',
      'http://auth-service:3001',
    );
    this.timeout = this.configService.get<number>('auth.service.timeout', 5000);
    this.retryAttempts = this.configService.get<number>(
      'auth.service.retryAttempts',
      3,
    );
    this.internalServiceKey = this.configService.get<string>(
      'auth.service.internalKey',
      '',
    );
  }

  async validateToken(
    request: ValidateTokenRequest,
  ): Promise<ValidateTokenResponse> {
    try {
      this.logger.debug('Validating token with Auth Service');

      const response = await firstValueFrom(
        this.httpService
          .post<ValidateTokenResponse>(
            `${this.baseUrl}/auth/validate`,
            request,
            {
              headers: {
                'Content-Type': 'application/json',
                'X-Internal-Service': 'library-service',
                'X-Internal-Key': this.internalServiceKey,
              },
            },
          )
          .pipe(
            timeout(this.timeout),
            retry(this.retryAttempts),
            catchError((error: AxiosError) => {
              this.logger.error('Auth Service validation failed', {
                error: error.message,
                status: error.response?.status,
                data: error.response?.data,
              });
              throw new HttpException(
                'Authentication service unavailable',
                HttpStatus.SERVICE_UNAVAILABLE,
              );
            }),
          ),
      );

      this.logger.debug('Token validation successful', {
        valid: response.data.valid,
        userId: response.data.user?.id,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to validate token', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Authentication service error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async validateInternalService(
    request: InternalServiceAuthRequest,
  ): Promise<InternalServiceAuthResponse> {
    try {
      this.logger.debug('Validating internal service access', {
        serviceId: request.serviceId,
        targetService: request.targetService,
        action: request.action,
      });

      const response = await firstValueFrom(
        this.httpService
          .post<InternalServiceAuthResponse>(
            `${this.baseUrl}/auth/internal/validate`,
            request,
            {
              headers: {
                'Content-Type': 'application/json',
                'X-Internal-Service': 'library-service',
                'X-Internal-Key': this.internalServiceKey,
              },
            },
          )
          .pipe(
            timeout(this.timeout),
            retry(this.retryAttempts),
            catchError((error: AxiosError) => {
              this.logger.error('Internal service validation failed', {
                error: error.message,
                status: error.response?.status,
                data: error.response?.data,
              });
              throw new HttpException(
                'Internal authentication service unavailable',
                HttpStatus.SERVICE_UNAVAILABLE,
              );
            }),
          ),
      );

      this.logger.debug('Internal service validation successful', {
        authorized: response.data.authorized,
        serviceId: response.data.serviceInfo?.id,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to validate internal service', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal authentication service error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/health`).pipe(
          timeout(this.timeout),
          catchError(() => {
            return Promise.resolve({ data: { status: 'error' } });
          }),
        ),
      );

      return (response.data as { status: string })?.status === 'ok';
    } catch (error) {
      this.logger.warn('Auth Service health check failed', error);
      return false;
    }
  }
}
