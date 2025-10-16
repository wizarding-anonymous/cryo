import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CircuitBreakerService, CircuitState } from './circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config = {
          CIRCUIT_BREAKER_FAILURE_THRESHOLD: 3,
          CIRCUIT_BREAKER_RECOVERY_TIMEOUT: 5000,
          CIRCUIT_BREAKER_MONITORING_PERIOD: 60000,
          CIRCUIT_BREAKER_ERROR_RATE: 0.5,
        };
        return config[key] || defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircuitBreakerService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('execute', () => {
    it('should execute operation successfully when circuit is closed', async () => {
      // Arrange
      const operation = jest.fn().mockResolvedValue('success');
      const circuitName = 'test-service';

      // Act
      const result = await service.execute(circuitName, operation);

      // Assert
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);

      const stats = service.getCircuitStats(circuitName);
      expect(stats?.state).toBe(CircuitState.CLOSED);
      expect(stats?.successes).toBe(1);
      expect(stats?.failures).toBe(0);
    });

    it('should record failure and keep circuit closed under threshold', async () => {
      // Arrange
      const operation = jest.fn().mockRejectedValue(new Error('Service error'));
      const circuitName = 'test-service';

      // Act & Assert
      await expect(service.execute(circuitName, operation)).rejects.toThrow(
        'Service error',
      );

      const stats = service.getCircuitStats(circuitName);
      expect(stats?.state).toBe(CircuitState.CLOSED);
      expect(stats?.failures).toBe(1);
    });

    it('should open circuit after failure threshold is reached', async () => {
      // Arrange
      const operation = jest.fn().mockRejectedValue(new Error('Service error'));
      const circuitName = 'test-service';

      // Act - Execute 3 times to reach threshold
      for (let i = 0; i < 3; i++) {
        try {
          await service.execute(circuitName, operation);
        } catch (error) {
          // Expected to fail
        }
      }

      // Assert
      const stats = service.getCircuitStats(circuitName);
      expect(stats?.state).toBe(CircuitState.OPEN);
      expect(stats?.failures).toBe(3);
    });

    it('should execute fallback when circuit is open', async () => {
      // Arrange
      const operation = jest.fn().mockRejectedValue(new Error('Service error'));
      const fallback = jest.fn().mockResolvedValue('fallback-result');
      const circuitName = 'test-service';

      // First, open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await service.execute(circuitName, operation);
        } catch (error) {
          // Expected to fail
        }
      }

      // Act - Execute with fallback when circuit is open
      const result = await service.execute(circuitName, operation, fallback);

      // Assert
      expect(result).toBe('fallback-result');
      expect(fallback).toHaveBeenCalledTimes(1);

      const stats = service.getCircuitStats(circuitName);
      expect(stats?.state).toBe(CircuitState.OPEN);
    });

    it('should throw error when circuit is open and no fallback provided', async () => {
      // Arrange
      const operation = jest.fn().mockRejectedValue(new Error('Service error'));
      const circuitName = 'test-service';

      // First, open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await service.execute(circuitName, operation);
        } catch (error) {
          // Expected to fail
        }
      }

      // Act & Assert
      await expect(service.execute(circuitName, operation)).rejects.toThrow(
        `Circuit ${circuitName} is OPEN`,
      );
    });

    it('should transition to half-open after recovery timeout', async () => {
      // Arrange
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Service error'))
        .mockRejectedValueOnce(new Error('Service error'))
        .mockRejectedValueOnce(new Error('Service error'))
        .mockResolvedValueOnce('recovered');

      const circuitName = 'test-service';

      // First, open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await service.execute(circuitName, operation);
        } catch (error) {
          // Expected to fail
        }
      }

      // Manually set next attempt to past (simulate timeout)
      const stats = service.getCircuitStats(circuitName);
      if (stats) {
        stats.nextAttempt = Date.now() - 1000;
      }

      // Act - Execute after timeout
      const result = await service.execute(circuitName, operation);

      // Assert
      expect(result).toBe('recovered');
      const updatedStats = service.getCircuitStats(circuitName);
      expect(updatedStats?.state).toBe(CircuitState.CLOSED);
    });

    it('should handle multiple circuits independently', async () => {
      // Arrange
      const successOperation = jest.fn().mockResolvedValue('success');
      const failOperation = jest
        .fn()
        .mockRejectedValue(new Error('Service error'));

      // Act
      await service.execute('service-1', successOperation);

      try {
        await service.execute('service-2', failOperation);
      } catch (error) {
        // Expected to fail
      }

      // Assert
      const stats1 = service.getCircuitStats('service-1');
      const stats2 = service.getCircuitStats('service-2');

      expect(stats1?.state).toBe(CircuitState.CLOSED);
      expect(stats1?.successes).toBe(1);
      expect(stats1?.failures).toBe(0);

      expect(stats2?.state).toBe(CircuitState.CLOSED);
      expect(stats2?.successes).toBe(0);
      expect(stats2?.failures).toBe(1);
    });
  });

  describe('getCircuitStats', () => {
    it('should return null for non-existent circuit', () => {
      const stats = service.getCircuitStats('non-existent');
      expect(stats).toBeNull();
    });

    it('should return stats for existing circuit', async () => {
      // Arrange
      const operation = jest.fn().mockResolvedValue('success');
      const circuitName = 'test-service';

      // Act
      await service.execute(circuitName, operation);

      // Assert
      const stats = service.getCircuitStats(circuitName);
      expect(stats).toEqual({
        failures: 0,
        successes: 1,
        lastFailureTime: 0,
        state: CircuitState.CLOSED,
        nextAttempt: 0,
      });
    });
  });

  describe('getAllCircuitsStatus', () => {
    it('should return empty object when no circuits exist', () => {
      const status = service.getAllCircuitsStatus();
      expect(status).toEqual({});
    });

    it('should return status for all circuits', async () => {
      // Arrange
      const operation = jest.fn().mockResolvedValue('success');

      // Act
      await service.execute('service-1', operation);
      await service.execute('service-2', operation);

      // Assert
      const status = service.getAllCircuitsStatus();
      expect(Object.keys(status)).toHaveLength(2);
      expect(status['service-1']).toBeDefined();
      expect(status['service-2']).toBeDefined();
    });
  });

  describe('resetCircuit', () => {
    it('should reset circuit stats', async () => {
      // Arrange
      const operation = jest.fn().mockRejectedValue(new Error('Service error'));
      const circuitName = 'test-service';

      // Create some failures
      try {
        await service.execute(circuitName, operation);
      } catch (error) {
        // Expected to fail
      }

      // Act
      service.resetCircuit(circuitName);

      // Assert
      const stats = service.getCircuitStats(circuitName);
      expect(stats?.failures).toBe(0);
      expect(stats?.successes).toBe(0);
      expect(stats?.state).toBe(CircuitState.CLOSED);
      expect(stats?.nextAttempt).toBe(0);
    });

    it('should handle reset of non-existent circuit gracefully', () => {
      // Act & Assert - should not throw
      expect(() => service.resetCircuit('non-existent')).not.toThrow();
    });
  });

  describe('openCircuit', () => {
    it('should manually open circuit', () => {
      // Arrange
      const circuitName = 'test-service';

      // Act
      service.openCircuit(circuitName);

      // Assert
      const stats = service.getCircuitStats(circuitName);
      expect(stats?.state).toBe(CircuitState.OPEN);
      expect(stats?.nextAttempt).toBeGreaterThan(Date.now());
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when all circuits are closed', async () => {
      // Arrange
      const operation = jest.fn().mockResolvedValue('success');
      await service.execute('service-1', operation);

      // Act
      const health = service.getHealthStatus();

      // Assert
      expect(health.healthy).toBe(true);
      expect(health.circuits['service-1'].state).toBe(CircuitState.CLOSED);
    });

    it('should return unhealthy status when any circuit is open', async () => {
      // Arrange
      const operation = jest.fn().mockRejectedValue(new Error('Service error'));

      // Open a circuit
      for (let i = 0; i < 3; i++) {
        try {
          await service.execute('service-1', operation);
        } catch (error) {
          // Expected to fail
        }
      }

      // Act
      const health = service.getHealthStatus();

      // Assert
      expect(health.healthy).toBe(false);
      expect(health.circuits['service-1'].state).toBe(CircuitState.OPEN);
    });
  });
});
