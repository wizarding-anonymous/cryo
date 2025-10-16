import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  expectedErrorRate: number;
}

export interface CircuitStats {
  failures: number;
  successes: number;
  lastFailureTime: number;
  state: CircuitState;
  nextAttempt: number;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly circuits = new Map<string, CircuitStats>();
  private readonly config: CircuitBreakerConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      failureThreshold: this.configService.get<number>(
        'CIRCUIT_BREAKER_FAILURE_THRESHOLD',
        5,
      ),
      recoveryTimeout: this.configService.get<number>(
        'CIRCUIT_BREAKER_RECOVERY_TIMEOUT',
        60000,
      ), // 1 minute
      monitoringPeriod: this.configService.get<number>(
        'CIRCUIT_BREAKER_MONITORING_PERIOD',
        300000,
      ), // 5 minutes
      expectedErrorRate: this.configService.get<number>(
        'CIRCUIT_BREAKER_ERROR_RATE',
        0.5,
      ), // 50%
    };
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(
    circuitName: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>,
  ): Promise<T> {
    const circuit = this.getOrCreateCircuit(circuitName);

    // Check if circuit is open
    if (circuit.state === CircuitState.OPEN) {
      if (Date.now() < circuit.nextAttempt) {
        this.logger.warn(`Circuit ${circuitName} is OPEN, executing fallback`);
        if (fallback) {
          return await fallback();
        }
        throw new Error(`Circuit ${circuitName} is OPEN`);
      } else {
        // Try to recover - move to HALF_OPEN
        circuit.state = CircuitState.HALF_OPEN;
        this.logger.log(`Circuit ${circuitName} moved to HALF_OPEN state`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess(circuitName);
      return result;
    } catch (error) {
      this.onFailure(circuitName, error);

      // Get updated circuit state after failure processing
      const updatedCircuit = this.circuits.get(circuitName);

      // If circuit is now open and we have fallback, use it
      if (updatedCircuit.state === CircuitState.OPEN && fallback) {
        this.logger.warn(`Circuit ${circuitName} opened, executing fallback`);
        return await fallback();
      }

      throw error;
    }
  }

  /**
   * Get circuit statistics
   */
  getCircuitStats(circuitName: string): CircuitStats | null {
    return this.circuits.get(circuitName) || null;
  }

  /**
   * Get all circuits status
   */
  getAllCircuitsStatus(): Record<string, CircuitStats> {
    const status: Record<string, CircuitStats> = {};
    this.circuits.forEach((stats, name) => {
      status[name] = { ...stats };
    });
    return status;
  }

  /**
   * Manually reset circuit
   */
  resetCircuit(circuitName: string): void {
    const circuit = this.circuits.get(circuitName);
    if (circuit) {
      circuit.failures = 0;
      circuit.successes = 0;
      circuit.state = CircuitState.CLOSED;
      circuit.nextAttempt = 0;
      this.logger.log(`Circuit ${circuitName} manually reset`);
    }
  }

  /**
   * Force circuit to open state
   */
  openCircuit(circuitName: string): void {
    const circuit = this.getOrCreateCircuit(circuitName);
    circuit.state = CircuitState.OPEN;
    circuit.nextAttempt = Date.now() + this.config.recoveryTimeout;
    this.logger.warn(`Circuit ${circuitName} manually opened`);
  }

  /**
   * Get or create circuit for service
   */
  private getOrCreateCircuit(circuitName: string): CircuitStats {
    if (!this.circuits.has(circuitName)) {
      this.circuits.set(circuitName, {
        failures: 0,
        successes: 0,
        lastFailureTime: 0,
        state: CircuitState.CLOSED,
        nextAttempt: 0,
      });
      this.logger.log(`Created new circuit breaker for: ${circuitName}`);
    }
    return this.circuits.get(circuitName);
  }

  /**
   * Handle successful operation
   */
  private onSuccess(circuitName: string): void {
    const circuit = this.circuits.get(circuitName);
    circuit.successes++;

    if (circuit.state === CircuitState.HALF_OPEN) {
      // Recovery successful - close the circuit
      circuit.state = CircuitState.CLOSED;
      circuit.failures = 0;
      this.logger.log(
        `Circuit ${circuitName} recovered and moved to CLOSED state`,
      );
    }

    // Clean up old failure records
    this.cleanupOldRecords(circuit);
  }

  /**
   * Handle failed operation
   */
  private onFailure(circuitName: string, error: any): void {
    const circuit = this.circuits.get(circuitName);
    circuit.failures++;
    circuit.lastFailureTime = Date.now();

    this.logger.warn(
      `Circuit ${circuitName} failure recorded. Total failures: ${circuit.failures}`,
      error.message,
    );

    // Check if we should open the circuit
    if (this.shouldOpenCircuit(circuit)) {
      circuit.state = CircuitState.OPEN;
      circuit.nextAttempt = Date.now() + this.config.recoveryTimeout;

      this.logger.error(
        `Circuit ${circuitName} OPENED due to ${circuit.failures} failures. ` +
          `Next attempt at: ${new Date(circuit.nextAttempt).toISOString()}`,
      );
    }
  }

  /**
   * Determine if circuit should be opened
   */
  private shouldOpenCircuit(circuit: CircuitStats): boolean {
    // Don't open if already open
    if (circuit.state === CircuitState.OPEN) {
      return false;
    }

    // Open if failure threshold exceeded
    if (circuit.failures >= this.config.failureThreshold) {
      return true;
    }

    // Open if error rate is too high (if we have enough samples)
    const totalRequests = circuit.failures + circuit.successes;
    if (totalRequests >= this.config.failureThreshold) {
      const errorRate = circuit.failures / totalRequests;
      if (errorRate >= this.config.expectedErrorRate) {
        return true;
      }
    }

    return false;
  }

  /**
   * Clean up old failure/success records
   */
  private cleanupOldRecords(circuit: CircuitStats): void {
    const cutoffTime = Date.now() - this.config.monitoringPeriod;

    // Reset counters if last failure was too long ago AND there were failures
    if (circuit.lastFailureTime > 0 && circuit.lastFailureTime < cutoffTime) {
      circuit.failures = 0;
      circuit.successes = 0;
    }
  }

  /**
   * Get circuit breaker health status
   */
  getHealthStatus(): {
    healthy: boolean;
    circuits: Record<string, { state: CircuitState; failures: number }>;
  } {
    const circuits: Record<string, { state: CircuitState; failures: number }> =
      {};
    let allHealthy = true;

    this.circuits.forEach((stats, name) => {
      circuits[name] = {
        state: stats.state,
        failures: stats.failures,
      };

      if (stats.state === CircuitState.OPEN) {
        allHealthy = false;
      }
    });

    return {
      healthy: allHealthy,
      circuits,
    };
  }
}
