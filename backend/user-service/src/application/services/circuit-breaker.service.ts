import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, CircuitBreaker>();

  createBreaker(name: string, fn: (...args: any[]) => Promise<any>, options?: CircuitBreaker.Options) {
    const defaultOptions: CircuitBreaker.Options = {
      timeout: 3000, // If the function takes longer than 3 seconds, trigger a failure
      errorThresholdPercentage: 50, // When 50% of requests fail, open the circuit
      resetTimeout: 30000, // After 30 seconds, try again.
    };

    const breaker = new CircuitBreaker(fn, { ...defaultOptions, ...options });

    breaker.on('open', () => this.logger.warn(`Circuit breaker '${name}' opened.`));
    breaker.on('halfOpen', () => this.logger.log(`Circuit breaker '${name}' is half-open.`));
    breaker.on('close', () => this.logger.log(`Circuit breaker '${name}' has closed.`));

    this.breakers.set(name, breaker);
    return breaker;
  }

  getBreaker(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  async execute<T>(name: string, fn: () => Promise<T>): Promise<T> {
    let breaker = this.breakers.get(name);

    if (!breaker) {
      breaker = this.createBreaker(name, fn);
    }

    return breaker.fire();
  }
}
