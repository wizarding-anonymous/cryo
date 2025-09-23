import { Injectable, Logger } from '@nestjs/common';

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitStats {
  failures: number;
  successes: number;
  lastFailureTime: number;
  state: CircuitState;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly circuits = new Map<string, CircuitStats>();
  private readonly defaultOptions: CircuitBreakerOptions = {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    monitoringPeriod: 300000, // 5 minutes
  };

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    circuitName: string,
    fn: () => Promise<T>,
    options: Partial<CircuitBreakerOptions> = {},
  ): Promise<T> {
    const opts = { ...this.defaultOptions, ...options };
    const circuit = this.getOrCreateCircuit(circuitName);

    // Check if circuit is open
    if (circuit.state === CircuitState.OPEN) {
      if (Date.now() - circuit.lastFailureTime > opts.resetTimeout) {
        // Try to transition to half-open
        circuit.state = CircuitState.HALF_OPEN;
        this.logger.log(`Circuit ${circuitName} transitioning to HALF_OPEN`);
      } else {
        throw new Error(`Circuit ${circuitName} is OPEN - failing fast`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess(circuitName);
      return result;
    } catch (error) {
      this.onFailure(circuitName, opts);
      throw error;
    }
  }

  /**
   * Check if circuit is available for requests
   */
  isAvailable(circuitName: string): boolean {
    const circuit = this.circuits.get(circuitName);
    if (!circuit) {
      return true;
    }

    return circuit.state !== CircuitState.OPEN;
  }

  /**
   * Get circuit statistics
   */
  getStats(circuitName: string): CircuitStats | null {
    return this.circuits.get(circuitName) || null;
  }

  /**
   * Get all circuit statistics
   */
  getAllStats(): Record<string, CircuitStats> {
    const stats: Record<string, CircuitStats> = {};
    for (const [name, circuit] of this.circuits.entries()) {
      stats[name] = { ...circuit };
    }
    return stats;
  }

  /**
   * Reset circuit to closed state
   */
  reset(circuitName: string): void {
    const circuit = this.circuits.get(circuitName);
    if (circuit) {
      circuit.state = CircuitState.CLOSED;
      circuit.failures = 0;
      circuit.successes = 0;
      circuit.lastFailureTime = 0;
      this.logger.log(`Circuit ${circuitName} manually reset to CLOSED`);
    }
  }

  private getOrCreateCircuit(circuitName: string): CircuitStats {
    if (!this.circuits.has(circuitName)) {
      this.circuits.set(circuitName, {
        failures: 0,
        successes: 0,
        lastFailureTime: 0,
        state: CircuitState.CLOSED,
      });
    }
    return this.circuits.get(circuitName)!;
  }

  private onSuccess(circuitName: string): void {
    const circuit = this.getOrCreateCircuit(circuitName);
    circuit.successes++;

    if (circuit.state === CircuitState.HALF_OPEN) {
      // Successful call in half-open state - close the circuit
      circuit.state = CircuitState.CLOSED;
      circuit.failures = 0;
      this.logger.log(`Circuit ${circuitName} closed after successful call`);
    }
  }

  private onFailure(circuitName: string, options: CircuitBreakerOptions): void {
    const circuit = this.getOrCreateCircuit(circuitName);
    circuit.failures++;
    circuit.lastFailureTime = Date.now();

    if (circuit.state === CircuitState.HALF_OPEN) {
      // Failure in half-open state - open the circuit again
      circuit.state = CircuitState.OPEN;
      this.logger.warn(`Circuit ${circuitName} opened after failure in HALF_OPEN state`);
    } else if (circuit.failures >= options.failureThreshold) {
      // Too many failures - open the circuit
      circuit.state = CircuitState.OPEN;
      this.logger.warn(
        `Circuit ${circuitName} opened after ${circuit.failures} failures (threshold: ${options.failureThreshold})`,
      );
    }
  }
}
