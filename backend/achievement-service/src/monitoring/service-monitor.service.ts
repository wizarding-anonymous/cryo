import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../metrics/metrics.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { of } from 'rxjs';

export interface ServiceHealthStatus {
  serviceName: string;
  isHealthy: boolean;
  responseTime: number;
  lastChecked: Date;
  error?: string;
}

export interface CircuitBreakerState {
  serviceName: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
}

@Injectable()
export class ServiceMonitorService {
  private readonly logger = new Logger(ServiceMonitorService.name);
  private readonly circuitBreakers = new Map<string, CircuitBreakerState>();
  private readonly serviceHealthStatus = new Map<string, ServiceHealthStatus>();
  
  private readonly services = [
    'notification',
    'library', 
    'payment',
    'review',
    'social'
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
    private readonly httpService: HttpService,
  ) {
    this.initializeCircuitBreakers();
    this.startHealthChecks();
  }

  private initializeCircuitBreakers() {
    this.services.forEach(serviceName => {
      this.circuitBreakers.set(serviceName, {
        serviceName,
        state: 'CLOSED',
        failureCount: 0,
      });
    });
  }

  private startHealthChecks() {
    const interval = this.configService.get<number>('health.interval', 30000);
    
    setInterval(async () => {
      await this.checkAllServicesHealth();
    }, interval);

    // Initial health check
    setTimeout(() => this.checkAllServicesHealth(), 5000);
  }

  async checkAllServicesHealth(): Promise<void> {
    const healthCheckPromises = this.services.map(serviceName => 
      this.checkServiceHealth(serviceName)
    );

    await Promise.allSettled(healthCheckPromises);
  }

  async checkServiceHealth(serviceName: string): Promise<ServiceHealthStatus> {
    const startTime = Date.now();
    const serviceUrl = this.configService.get<string>(`services.${serviceName}`);
    const serviceTimeout = this.configService.get<number>('services.timeout', 5000);

    try {
      // Use correct health endpoints based on service specifications
      let healthUrl: string;
      if (serviceName === 'review') {
        healthUrl = `${serviceUrl}/api/v1/health`;
      } else {
        healthUrl = `${serviceUrl}/health`;
      }
      
      await firstValueFrom(
        this.httpService.get(healthUrl).pipe(
          timeout(serviceTimeout),
          catchError(error => {
            throw error;
          })
        )
      );

      const responseTime = Date.now() - startTime;
      const status: ServiceHealthStatus = {
        serviceName,
        isHealthy: true,
        responseTime,
        lastChecked: new Date(),
      };

      this.serviceHealthStatus.set(serviceName, status);
      this.handleSuccessfulCall(serviceName);
      
      this.metricsService.incrementServiceCall(serviceName, 'health_check', 'success');
      this.metricsService.observeServiceCallDuration(serviceName, 'health_check', responseTime / 1000);

      this.logger.debug(`Service ${serviceName} health check passed (${responseTime}ms)`);
      return status;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const status: ServiceHealthStatus = {
        serviceName,
        isHealthy: false,
        responseTime,
        lastChecked: new Date(),
        error: (error as Error).message,
      };

      this.serviceHealthStatus.set(serviceName, status);
      this.handleFailedCall(serviceName, error);
      
      this.metricsService.incrementServiceCall(serviceName, 'health_check', 'error');
      this.metricsService.incrementServiceError(serviceName, (error as any).code || 'unknown');
      this.metricsService.observeServiceCallDuration(serviceName, 'health_check', responseTime / 1000);

      this.logger.warn(`Service ${serviceName} health check failed: ${(error as Error).message}`);
      return status;
    }
  }

  async callService<T>(
    serviceName: string, 
    method: string, 
    url: string, 
    data?: any
  ): Promise<T> {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    
    if (circuitBreaker?.state === 'OPEN') {
      const now = new Date();
      if (circuitBreaker.nextRetryTime && now < circuitBreaker.nextRetryTime) {
        throw new Error(`Circuit breaker is OPEN for service ${serviceName}`);
      } else {
        // Try to transition to HALF_OPEN
        circuitBreaker.state = 'HALF_OPEN';
        this.logger.log(`Circuit breaker for ${serviceName} transitioning to HALF_OPEN`);
      }
    }

    const startTime = Date.now();
    const serviceTimeout = this.configService.get<number>('services.timeout', 5000);

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method: method.toUpperCase() as any,
          url,
          data,
          timeout: serviceTimeout,
        }).pipe(
          timeout(serviceTimeout),
          catchError(error => {
            throw error;
          })
        )
      );

      const responseTime = Date.now() - startTime;
      
      this.handleSuccessfulCall(serviceName);
      this.metricsService.incrementServiceCall(serviceName, method, 'success');
      this.metricsService.observeServiceCallDuration(serviceName, method, responseTime / 1000);

      return (response as any).data;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.handleFailedCall(serviceName, error);
      this.metricsService.incrementServiceCall(serviceName, method, 'error');
      this.metricsService.incrementServiceError(serviceName, (error as any).code || 'unknown');
      this.metricsService.observeServiceCallDuration(serviceName, method, responseTime / 1000);

      throw error;
    }
  }

  private handleSuccessfulCall(serviceName: string) {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    if (circuitBreaker) {
      circuitBreaker.failureCount = 0;
      circuitBreaker.state = 'CLOSED';
      circuitBreaker.lastFailureTime = undefined;
      circuitBreaker.nextRetryTime = undefined;
    }
  }

  private handleFailedCall(serviceName: string, error: any) {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    if (!circuitBreaker) return;

    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = new Date();

    const threshold = this.configService.get<number>('services.circuitBreakerThreshold', 5);
    const timeoutMs = this.configService.get<number>('services.circuitBreakerTimeout', 60000);

    if (circuitBreaker.failureCount >= threshold) {
      circuitBreaker.state = 'OPEN';
      circuitBreaker.nextRetryTime = new Date(Date.now() + timeoutMs);
      
      this.logger.error(
        `Circuit breaker OPENED for service ${serviceName} after ${circuitBreaker.failureCount} failures`
      );
    }
  }

  getServiceHealthStatus(serviceName: string): ServiceHealthStatus | undefined {
    return this.serviceHealthStatus.get(serviceName);
  }

  getAllServiceHealthStatus(): ServiceHealthStatus[] {
    return Array.from(this.serviceHealthStatus.values());
  }

  getCircuitBreakerState(serviceName: string): CircuitBreakerState | undefined {
    return this.circuitBreakers.get(serviceName);
  }

  getAllCircuitBreakerStates(): CircuitBreakerState[] {
    return Array.from(this.circuitBreakers.values());
  }

  isServiceHealthy(serviceName: string): boolean {
    const status = this.serviceHealthStatus.get(serviceName);
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    
    return status?.isHealthy === true && circuitBreaker?.state !== 'OPEN';
  }
}