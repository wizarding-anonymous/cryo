import { Injectable, Logger } from '@nestjs/common';
import * as CircuitBreaker from 'opossum';
import { CircuitBreakerConfig, CircuitBreakerOptions } from './circuit-breaker.config';

export interface CircuitBreakerStats {
  name: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  successes: number;
  rejections: number;
  timeouts: number;
  fallbacks: number;
  semaphoreRejections: number;
  percentileLatency: {
    '0.0': number;
    '0.25': number;
    '0.5': number;
    '0.75': number;
    '0.9': number;
    '0.95': number;
    '0.99': number;
    '0.995': number;
    '1.0': number;
  };
  rollingCountBadRequests: number;
  rollingCountCollapsedRequests: number;
  rollingCountExceptionsThrown: number;
  rollingCountFailure: number;
  rollingCountFallbackFailure: number;
  rollingCountFallbackRejection: number;
  rollingCountFallbackSuccess: number;
  rollingCountResponsesFromCache: number;
  rollingCountSemaphoreRejected: number;
  rollingCountShortCircuited: number;
  rollingCountSuccess: number;
  rollingCountThreadPoolRejected: number;
  rollingCountTimeout: number;
  currentConcurrentExecutionCount: number;
  latencyExecute_mean: number;
  latencyExecute: {
    '0.0': number;
    '0.25': number;
    '0.5': number;
    '0.75': number;
    '0.9': number;
    '0.95': number;
    '0.99': number;
    '0.995': number;
    '1.0': number;
  };
  latencyTotal_mean: number;
  latencyTotal: {
    '0.0': number;
    '0.25': number;
    '0.5': number;
    '0.75': number;
    '0.9': number;
    '0.95': number;
    '0.99': number;
    '0.995': number;
    '1.0': number;
  };
  propertyValue_circuitBreakerRequestVolumeThreshold: number;
  propertyValue_circuitBreakerSleepWindowInMilliseconds: number;
  propertyValue_circuitBreakerErrorThresholdPercentage: number;
  propertyValue_circuitBreakerForceOpen: boolean;
  propertyValue_circuitBreakerForceClosed: boolean;
  propertyValue_executionIsolationStrategy: string;
  propertyValue_executionIsolationThreadTimeoutInMilliseconds: number;
  propertyValue_executionTimeoutInMilliseconds: number;
  propertyValue_executionIsolationThreadInterruptOnTimeout: boolean;
  propertyValue_executionIsolationThreadPoolKeyOverride: string;
  propertyValue_executionIsolationSemaphoreMaxConcurrentRequests: number;
  propertyValue_fallbackIsolationSemaphoreMaxConcurrentRequests: number;
  propertyValue_metricsRollingStatisticalWindowInMilliseconds: number;
  propertyValue_requestCacheEnabled: boolean;
  propertyValue_requestLogEnabled: boolean;
  reportingHosts: number;
  threadPool: string;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();

  constructor(private readonly circuitBreakerConfig: CircuitBreakerConfig) {}

  /**
   * Create a new circuit breaker with monitoring and logging
   */
  createCircuitBreaker<T extends any[], R>(
    action: (...args: T) => Promise<R>,
    options: CircuitBreakerOptions,
  ): CircuitBreaker<T, R> {
    const circuitBreaker = new CircuitBreaker(action, options);
    const name = options.name || 'Unknown';

    // Store circuit breaker for monitoring
    this.circuitBreakers.set(name, circuitBreaker);

    // Set up event listeners for monitoring and logging
    this.setupCircuitBreakerEvents(circuitBreaker, name);

    return circuitBreaker;
  }

  /**
   * Get circuit breaker by name
   */
  getCircuitBreaker(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  /**
   * Get all circuit breaker names
   */
  getCircuitBreakerNames(): string[] {
    return Array.from(this.circuitBreakers.keys());
  }

  /**
   * Get circuit breaker statistics
   */
  getCircuitBreakerStats(name: string): CircuitBreakerStats | null {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (!circuitBreaker) {
      return null;
    }

    const stats = circuitBreaker.stats;
    return {
      name,
      state: this.getCircuitBreakerState(circuitBreaker),
      failures: stats.failures,
      successes: stats.successes,
      rejections: stats.rejections,
      timeouts: stats.timeouts,
      fallbacks: stats.fallbacks,
      semaphoreRejections: stats.semaphoreRejections,
      percentileLatency: stats.percentileLatency,
      rollingCountBadRequests: stats.rollingCountBadRequests,
      rollingCountCollapsedRequests: stats.rollingCountCollapsedRequests,
      rollingCountExceptionsThrown: stats.rollingCountExceptionsThrown,
      rollingCountFailure: stats.rollingCountFailure,
      rollingCountFallbackFailure: stats.rollingCountFallbackFailure,
      rollingCountFallbackRejection: stats.rollingCountFallbackRejection,
      rollingCountFallbackSuccess: stats.rollingCountFallbackSuccess,
      rollingCountResponsesFromCache: stats.rollingCountResponsesFromCache,
      rollingCountSemaphoreRejected: stats.rollingCountSemaphoreRejected,
      rollingCountShortCircuited: stats.rollingCountShortCircuited,
      rollingCountSuccess: stats.rollingCountSuccess,
      rollingCountThreadPoolRejected: stats.rollingCountThreadPoolRejected,
      rollingCountTimeout: stats.rollingCountTimeout,
      currentConcurrentExecutionCount: stats.currentConcurrentExecutionCount,
      latencyExecute_mean: stats.latencyExecute_mean,
      latencyExecute: stats.latencyExecute,
      latencyTotal_mean: stats.latencyTotal_mean,
      latencyTotal: stats.latencyTotal,
      propertyValue_circuitBreakerRequestVolumeThreshold: stats.propertyValue_circuitBreakerRequestVolumeThreshold,
      propertyValue_circuitBreakerSleepWindowInMilliseconds: stats.propertyValue_circuitBreakerSleepWindowInMilliseconds,
      propertyValue_circuitBreakerErrorThresholdPercentage: stats.propertyValue_circuitBreakerErrorThresholdPercentage,
      propertyValue_circuitBreakerForceOpen: stats.propertyValue_circuitBreakerForceOpen,
      propertyValue_circuitBreakerForceClosed: stats.propertyValue_circuitBreakerForceClosed,
      propertyValue_executionIsolationStrategy: stats.propertyValue_executionIsolationStrategy,
      propertyValue_executionIsolationThreadTimeoutInMilliseconds: stats.propertyValue_executionIsolationThreadTimeoutInMilliseconds,
      propertyValue_executionTimeoutInMilliseconds: stats.propertyValue_executionTimeoutInMilliseconds,
      propertyValue_executionIsolationThreadInterruptOnTimeout: stats.propertyValue_executionIsolationThreadInterruptOnTimeout,
      propertyValue_executionIsolationThreadPoolKeyOverride: stats.propertyValue_executionIsolationThreadPoolKeyOverride,
      propertyValue_executionIsolationSemaphoreMaxConcurrentRequests: stats.propertyValue_executionIsolationSemaphoreMaxConcurrentRequests,
      propertyValue_fallbackIsolationSemaphoreMaxConcurrentRequests: stats.propertyValue_fallbackIsolationSemaphoreMaxConcurrentRequests,
      propertyValue_metricsRollingStatisticalWindowInMilliseconds: stats.propertyValue_metricsRollingStatisticalWindowInMilliseconds,
      propertyValue_requestCacheEnabled: stats.propertyValue_requestCacheEnabled,
      propertyValue_requestLogEnabled: stats.propertyValue_requestLogEnabled,
      reportingHosts: stats.reportingHosts,
      threadPool: stats.threadPool,
    };
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllCircuitBreakerStats(): CircuitBreakerStats[] {
    return this.getCircuitBreakerNames()
      .map(name => this.getCircuitBreakerStats(name))
      .filter(stats => stats !== null);
  }

  /**
   * Reset circuit breaker statistics
   */
  resetCircuitBreakerStats(name: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (!circuitBreaker) {
      return false;
    }

    // Clear the circuit breaker's internal state
    circuitBreaker.clearCache();
    this.logger.log(`Circuit breaker stats reset for: ${name}`);
    return true;
  }

  /**
   * Force open circuit breaker
   */
  forceOpenCircuitBreaker(name: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (!circuitBreaker) {
      return false;
    }

    circuitBreaker.open();
    this.logger.warn(`Circuit breaker forced open: ${name}`);
    return true;
  }

  /**
   * Force close circuit breaker
   */
  forceCloseCircuitBreaker(name: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (!circuitBreaker) {
      return false;
    }

    circuitBreaker.close();
    this.logger.log(`Circuit breaker forced closed: ${name}`);
    return true;
  }

  /**
   * Get circuit breaker state
   */
  private getCircuitBreakerState(circuitBreaker: CircuitBreaker): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    if (circuitBreaker.opened) {
      return 'OPEN';
    }
    if (circuitBreaker.halfOpen) {
      return 'HALF_OPEN';
    }
    return 'CLOSED';
  }

  /**
   * Set up event listeners for circuit breaker monitoring and logging
   */
  private setupCircuitBreakerEvents(circuitBreaker: CircuitBreaker, name: string): void {
    // Circuit breaker state changes
    circuitBreaker.on('open', () => {
      this.logger.warn(`Circuit breaker opened: ${name}`, {
        circuitBreaker: name,
        state: 'OPEN',
        stats: circuitBreaker.stats,
      });
    });

    circuitBreaker.on('close', () => {
      this.logger.log(`Circuit breaker closed: ${name}`, {
        circuitBreaker: name,
        state: 'CLOSED',
        stats: circuitBreaker.stats,
      });
    });

    circuitBreaker.on('halfOpen', () => {
      this.logger.log(`Circuit breaker half-open: ${name}`, {
        circuitBreaker: name,
        state: 'HALF_OPEN',
        stats: circuitBreaker.stats,
      });
    });

    // Request events
    circuitBreaker.on('success', (result) => {
      this.logger.debug(`Circuit breaker success: ${name}`, {
        circuitBreaker: name,
        result: typeof result,
      });
    });

    circuitBreaker.on('failure', (error) => {
      this.logger.error(`Circuit breaker failure: ${name}`, {
        circuitBreaker: name,
        error: error.message,
        stack: error.stack,
      });
    });

    circuitBreaker.on('timeout', () => {
      this.logger.warn(`Circuit breaker timeout: ${name}`, {
        circuitBreaker: name,
        timeout: circuitBreaker.options.timeout,
      });
    });

    circuitBreaker.on('reject', () => {
      this.logger.warn(`Circuit breaker rejected request: ${name}`, {
        circuitBreaker: name,
        state: this.getCircuitBreakerState(circuitBreaker),
      });
    });

    circuitBreaker.on('fallback', (result) => {
      this.logger.warn(`Circuit breaker fallback executed: ${name}`, {
        circuitBreaker: name,
        fallbackResult: typeof result,
      });
    });

    // Semaphore events
    circuitBreaker.on('semaphoreLocked', (error) => {
      this.logger.warn(`Circuit breaker semaphore locked: ${name}`, {
        circuitBreaker: name,
        error: error?.message,
      });
    });

    // Health snapshot events
    circuitBreaker.on('snapshot', (snapshot) => {
      this.logger.debug(`Circuit breaker snapshot: ${name}`, {
        circuitBreaker: name,
        snapshot,
      });
    });
  }
}