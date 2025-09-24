import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { GameCatalogClient } from '../clients/game-catalog.client';
import { PaymentServiceClient } from '../clients/payment-service.client';
import { UserServiceClient } from '../clients/user.client';

interface ServiceHealthStatus {
  isHealthy: boolean;
  responseTime?: number;
  error?: string;
  circuitBreakerState?: string;
}

@Injectable()
export class ExternalServicesHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(ExternalServicesHealthIndicator.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly gameCatalogClient: GameCatalogClient,
    private readonly paymentServiceClient: PaymentServiceClient,
    private readonly userServiceClient: UserServiceClient,
  ) {
    super();
  }

  async checkGameCatalogService(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    
    try {
      // Use a lightweight operation to check service health
      await this.gameCatalogClient.doesGameExist('health-check-dummy-id');
      const responseTime = Date.now() - startTime;

      return this.getStatus(key, true, {
        responseTime,
        healthStatus: 'operational',
      });
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.warn(`Game Catalog Service health check failed: ${errorMessage}`);
      
      const isCircuitBreakerOpen = errorMessage.includes('Circuit breaker is OPEN');
      
      return this.getStatus(key, false, {
        responseTime,
        error: errorMessage,
        circuitBreakerOpen: isCircuitBreakerOpen,
        healthStatus: 'degraded',
      });
    }
  }

  async checkPaymentService(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    
    try {
      // Use a lightweight operation to check service health
      await this.paymentServiceClient.getOrderStatus('health-check-dummy-id');
      const responseTime = Date.now() - startTime;

      return this.getStatus(key, true, {
        responseTime,
        healthStatus: 'operational',
      });
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.warn(`Payment Service health check failed: ${errorMessage}`);
      
      const isCircuitBreakerOpen = errorMessage.includes('Circuit breaker is OPEN');
      
      return this.getStatus(key, false, {
        responseTime,
        error: errorMessage,
        circuitBreakerOpen: isCircuitBreakerOpen,
        healthStatus: 'degraded',
      });
    }
  }

  async checkUserService(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    
    try {
      // Use a lightweight operation to check service health
      await this.userServiceClient.doesUserExist('health-check-dummy-id');
      const responseTime = Date.now() - startTime;

      return this.getStatus(key, true, {
        responseTime,
        healthStatus: 'operational',
      });
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.warn(`User Service health check failed: ${errorMessage}`);
      
      const isCircuitBreakerOpen = errorMessage.includes('Circuit breaker is OPEN');
      
      return this.getStatus(key, false, {
        responseTime,
        error: errorMessage,
        circuitBreakerOpen: isCircuitBreakerOpen,
        healthStatus: 'degraded',
      });
    }
  }

  async checkAllExternalServices(key: string): Promise<HealthIndicatorResult> {
    const services = ['game-catalog', 'payment', 'user'];
    const results: Record<string, ServiceHealthStatus> = {};
    let overallHealthy = true;

    // Check all services in parallel
    const checks = await Promise.allSettled([
      this.checkGameCatalogService('game-catalog'),
      this.checkPaymentService('payment'),
      this.checkUserService('user'),
    ]);

    checks.forEach((result, index) => {
      const serviceName = services[index];
      
      if (result.status === 'fulfilled') {
        const healthResult = result.value;
        results[serviceName] = {
          isHealthy: healthResult[serviceName].status === 'up',
          responseTime: healthResult[serviceName].responseTime,
          circuitBreakerState: healthResult[serviceName].circuitBreakerOpen ? 'OPEN' : 'CLOSED',
        };
      } else {
        results[serviceName] = {
          isHealthy: false,
          error: result.reason?.message || 'Unknown error',
        };
        overallHealthy = false;
      }

      if (!results[serviceName].isHealthy) {
        overallHealthy = false;
      }
    });

    return this.getStatus(key, overallHealthy, {
      services: results,
      summary: {
        total: services.length,
        healthy: Object.values(results).filter(r => r.isHealthy).length,
        degraded: Object.values(results).filter(r => !r.isHealthy).length,
      },
    });
  }
}