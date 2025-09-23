import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError, AxiosRequestConfig } from 'axios';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export class ExternalServiceError extends Error {
  constructor(
    public readonly service: string,
    public readonly operation: string,
    public readonly statusCode?: number,
    message?: string,
    public readonly retryable: boolean = false,
  ) {
    super(message || 'External service error');
    this.name = 'ExternalServiceError';
  }
}

@Injectable()
export abstract class ExternalServiceBase {
  protected readonly defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
  };

  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
  ) {}

  protected async makeRequestWithRetry<T>(
    url: string,
    config: AxiosRequestConfig = {},
    retryConfig: Partial<RetryConfig> = {},
    serviceName: string,
    operation: string,
  ): Promise<T> {
    const finalRetryConfig = { ...this.defaultRetryConfig, ...retryConfig };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= finalRetryConfig.maxRetries; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.request<T>({
            url,
            timeout: 5000,
            headers: {
              'Content-Type': 'application/json',
              ...config.headers,
            },
            ...config,
          })
        );

        return response.data;
      } catch (error) {
        lastError = error as Error;
        
        if (this.isAxiosError(error)) {
          // Не повторяем запрос для клиентских ошибок (4xx)
          if (error.response?.status && error.response.status >= 400 && error.response.status < 500) {
            throw this.createExternalServiceError(
              serviceName,
              operation,
              error.response.status,
              error.message,
              false
            );
          }
        }

        // Если это не последняя попытка, ждем перед повтором
        if (attempt < finalRetryConfig.maxRetries) {
          const delay = Math.min(
            finalRetryConfig.baseDelay * Math.pow(finalRetryConfig.backoffFactor, attempt - 1),
            finalRetryConfig.maxDelay
          );
          await this.delay(delay);
        }
      }
    }

    // Если все попытки неудачны, выбрасываем ошибку
    const statusCode = this.isAxiosError(lastError) ? lastError.response?.status : undefined;
    throw this.createExternalServiceError(
      serviceName,
      operation,
      statusCode,
      lastError?.message || 'Unknown error',
      true
    );
  }

  protected createExternalServiceError(
    service: string,
    operation: string,
    statusCode?: number,
    message?: string,
    retryable: boolean = false,
  ): ExternalServiceError {
    return new ExternalServiceError(service, operation, statusCode, message, retryable);
  }

  protected isAxiosError(error: any): error is AxiosError {
    return error.isAxiosError === true;
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected getServiceUrl(serviceName: string): string {
    return this.configService.get<string>(`app.services.${serviceName}`)!;
  }
}