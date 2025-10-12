import { ConfigService } from '@nestjs/config';
import { CircuitBreakerService } from './circuit-breaker.service';
import { CircuitBreakerConfig } from './circuit-breaker.config';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;
  let circuitBreakerConfig: CircuitBreakerConfig;
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config = {
          CIRCUIT_BREAKER_TIMEOUT: 3000,
          CIRCUIT_BREAKER_ERROR_THRESHOLD: 50,
          CIRCUIT_BREAKER_RESET_TIMEOUT: 30000,
          CIRCUIT_BREAKER_ROLLING_TIMEOUT: 10000,
          CIRCUIT_BREAKER_ROLLING_BUCKETS: 10,
          CIRCUIT_BREAKER_VOLUME_THRESHOLD: 10,
        };
        return config[key] || defaultValue;
      }),
    } as any;

    circuitBreakerConfig = new CircuitBreakerConfig(configService);
    service = new CircuitBreakerService(circuitBreakerConfig);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCircuitBreaker', () => {
    it('should create a circuit breaker with the provided configuration', async () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      const options = {
        timeout: 1000,
        errorThresholdPercentage: 50,
        resetTimeout: 5000,
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10,
        volumeThreshold: 5,
        name: 'TestService',
      };

      const circuitBreaker = service.createCircuitBreaker(mockAction, options);

      expect(circuitBreaker).toBeDefined();
      expect(circuitBreaker.name).toBe('TestService');
      expect(circuitBreaker.options.timeout).toBe(1000);
      expect(circuitBreaker.options.errorThresholdPercentage).toBe(50);
    });

    it('should store the circuit breaker for monitoring', () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      const options = {
        timeout: 1000,
        errorThresholdPercentage: 50,
        resetTimeout: 5000,
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10,
        volumeThreshold: 5,
        name: 'TestService',
      };

      service.createCircuitBreaker(mockAction, options);

      expect(service.getCircuitBreakerNames()).toContain('TestService');
      expect(service.getCircuitBreaker('TestService')).toBeDefined();
    });

    it('should execute the action successfully', async () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      const options = {
        timeout: 1000,
        errorThresholdPercentage: 50,
        resetTimeout: 5000,
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10,
        volumeThreshold: 5,
        name: 'TestService',
      };

      const circuitBreaker = service.createCircuitBreaker(mockAction, options);
      const result = await circuitBreaker.fire();

      expect(result).toBe('success');
      expect(mockAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCircuitBreaker', () => {
    it('should return undefined for non-existent circuit breaker', () => {
      const result = service.getCircuitBreaker('NonExistent');
      expect(result).toBeUndefined();
    });

    it('should return the circuit breaker if it exists', () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      const options = {
        timeout: 1000,
        errorThresholdPercentage: 50,
        resetTimeout: 5000,
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10,
        volumeThreshold: 5,
        name: 'TestService',
      };

      const createdCircuitBreaker = service.createCircuitBreaker(mockAction, options);
      const retrievedCircuitBreaker = service.getCircuitBreaker('TestService');

      expect(retrievedCircuitBreaker).toBe(createdCircuitBreaker);
    });
  });

  describe('getCircuitBreakerNames', () => {
    it('should return empty array when no circuit breakers exist', () => {
      const names = service.getCircuitBreakerNames();
      expect(names).toEqual([]);
    });

    it('should return all circuit breaker names', () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      const options1 = {
        timeout: 1000,
        errorThresholdPercentage: 50,
        resetTimeout: 5000,
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10,
        volumeThreshold: 5,
        name: 'Service1',
      };
      const options2 = {
        timeout: 1000,
        errorThresholdPercentage: 50,
        resetTimeout: 5000,
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10,
        volumeThreshold: 5,
        name: 'Service2',
      };

      service.createCircuitBreaker(mockAction, options1);
      service.createCircuitBreaker(mockAction, options2);

      const names = service.getCircuitBreakerNames();
      expect(names).toContain('Service1');
      expect(names).toContain('Service2');
      expect(names).toHaveLength(2);
    });
  });

  describe('getCircuitBreakerStats', () => {
    it('should return null for non-existent circuit breaker', () => {
      const stats = service.getCircuitBreakerStats('NonExistent');
      expect(stats).toBeNull();
    });

    it('should return statistics for existing circuit breaker', () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      const options = {
        timeout: 1000,
        errorThresholdPercentage: 50,
        resetTimeout: 5000,
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10,
        volumeThreshold: 5,
        name: 'TestService',
      };

      service.createCircuitBreaker(mockAction, options);
      const stats = service.getCircuitBreakerStats('TestService');

      expect(stats).toBeDefined();
      expect(stats.name).toBe('TestService');
      expect(stats.state).toBe('CLOSED');
      expect(typeof stats.failures).toBe('number');
      expect(typeof stats.successes).toBe('number');
    });
  });

  describe('resetCircuitBreakerStats', () => {
    it('should return false for non-existent circuit breaker', () => {
      const result = service.resetCircuitBreakerStats('NonExistent');
      expect(result).toBe(false);
    });

    it('should reset statistics for existing circuit breaker', () => {
      const mockAction = jest.fn().mockResolvedValue('success');
      const options = {
        timeout: 1000,
        errorThresholdPercentage: 50,
        resetTimeout: 5000,
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10,
        volumeThreshold: 5,
        name: 'TestService',
      };

      service.createCircuitBreaker(mockAction, options);
      const result = service.resetCircuitBreakerStats('TestService');

      expect(result).toBe(true);
    });
  });
});