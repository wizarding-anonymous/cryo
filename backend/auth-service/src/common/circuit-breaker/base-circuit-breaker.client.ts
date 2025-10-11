import { Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import * as CircuitBreaker from 'opossum';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse, AxiosRequestConfig } from 'axios';
import { CircuitBreakerService } from './circuit-breaker.service';
import { CircuitBreakerOptions } from './circuit-breaker.config';

export abstract class BaseCircuitBreakerClient {
  protected readonly logger: Logger;
  protected readonly baseUrl: string;
  protected readonly circuitBreaker: CircuitBreaker;

  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
    protected readonly circuitBreakerService: CircuitBreakerService,
    serviceName: string,
    urlConfigKey: string,
    defaultUrl: string,
    circuitBreakerOptions: CircuitBreakerOptions,
  ) {
    this.logger = new Logger(`${serviceName}Client`);
    this.baseUrl = this.configService.get<string>(urlConfigKey, defaultUrl);
    
    // Create circuit breaker for HTTP requests
    this.circuitBreaker = this.circuitBreakerService.createCircuitBreaker(
      this.makeHttpRequest.bind(this),
      {
        ...circuitBreakerOptions,
        name: serviceName,
      },
    );

    // Set up fallback function
    this.circuitBreaker.fallback(() => {
      throw new ServiceUnavailableError(`${serviceName} is currently unavailable`);
    });
  }

  /**
   * Make HTTP request through circuit breaker
   */
  protected async makeRequest<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    try {
      const response = await this.circuitBreaker.fire(method, url, data, config);
      return response.data;
    } catch (error) {
      if (error instanceof ServiceUnavailableError) {
        this.logger.warn(`Service unavailable: ${error.message}`);
        throw error;
      }
      
      // Log the original error
      this.logger.error(`HTTP request failed: ${method} ${url}`, {
        error: error.message,
        stack: error.stack,
        data,
      });
      
      throw error;
    }
  }

  /**
   * Make GET request through circuit breaker
   */
  protected async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.makeRequest<T>('GET', url, undefined, config);
  }

  /**
   * Make POST request through circuit breaker
   */
  protected async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.makeRequest<T>('POST', url, data, config);
  }

  /**
   * Make PUT request through circuit breaker
   */
  protected async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.makeRequest<T>('PUT', url, data, config);
  }

  /**
   * Make PATCH request through circuit breaker
   */
  protected async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.makeRequest<T>('PATCH', url, data, config);
  }

  /**
   * Make DELETE request through circuit breaker
   */
  protected async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.makeRequest<T>('DELETE', url, undefined, config);
  }

  /**
   * Get circuit breaker statistics
   */
  getCircuitBreakerStats() {
    return this.circuitBreakerService.getCircuitBreakerStats(this.circuitBreaker.name);
  }

  /**
   * Check if circuit breaker is open
   */
  isCircuitBreakerOpen(): boolean {
    return this.circuitBreaker.opened;
  }

  /**
   * Check if circuit breaker is half-open
   */
  isCircuitBreakerHalfOpen(): boolean {
    return this.circuitBreaker.halfOpen;
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    if (this.circuitBreaker.opened) {
      return 'OPEN';
    }
    if (this.circuitBreaker.halfOpen) {
      return 'HALF_OPEN';
    }
    return 'CLOSED';
  }

  /**
   * Internal method to make HTTP requests
   */
  private async makeHttpRequest(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    
    switch (method) {
      case 'GET':
        return firstValueFrom(this.httpService.get(fullUrl, config));
      case 'POST':
        return firstValueFrom(this.httpService.post(fullUrl, data, config));
      case 'PUT':
        return firstValueFrom(this.httpService.put(fullUrl, data, config));
      case 'PATCH':
        return firstValueFrom(this.httpService.patch(fullUrl, data, config));
      case 'DELETE':
        return firstValueFrom(this.httpService.delete(fullUrl, config));
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  }
}

/**
 * Custom error for service unavailability
 */
export class ServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}