import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';

// Mock the Prometheus metrics
const mockCounter = {
  inc: jest.fn(),
};

const mockGauge = {
  set: jest.fn(),
};

const mockHistogram = {
  observe: jest.fn(),
};

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: MetricsService,
          useValue: {
            recordHealthCheck: jest.fn(),
            setExternalServiceStatus: jest.fn(),
            recordExternalServiceResponseTime: jest.fn(),
            setDatabaseConnections: jest.fn(),
            recordCacheOperation: jest.fn(),
            setCircuitBreakerState: jest.fn(),
            getMetrics: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordHealthCheck', () => {
    it('should record health check with success status', () => {
      service.recordHealthCheck('database', 'success');
      expect(service.recordHealthCheck).toHaveBeenCalledWith('database', 'success');
    });

    it('should record health check with failure status', () => {
      service.recordHealthCheck('redis', 'failure');
      expect(service.recordHealthCheck).toHaveBeenCalledWith('redis', 'failure');
    });
  });

  describe('setExternalServiceStatus', () => {
    it('should set service status to healthy', () => {
      service.setExternalServiceStatus('game-catalog', 1);
      expect(service.setExternalServiceStatus).toHaveBeenCalledWith('game-catalog', 1);
    });

    it('should set service status to unhealthy', () => {
      service.setExternalServiceStatus('payment', 0);
      expect(service.setExternalServiceStatus).toHaveBeenCalledWith('payment', 0);
    });
  });

  describe('recordExternalServiceResponseTime', () => {
    it('should record response time', () => {
      service.recordExternalServiceResponseTime('user', 1500);
      expect(service.recordExternalServiceResponseTime).toHaveBeenCalledWith('user', 1500);
    });
  });

  describe('setDatabaseConnections', () => {
    it('should set database connection counts', () => {
      service.setDatabaseConnections(5, 10);
      expect(service.setDatabaseConnections).toHaveBeenCalledWith(5, 10);
    });
  });

  describe('recordCacheOperation', () => {
    it('should record cache hit', () => {
      service.recordCacheOperation('get', 'hit');
      expect(service.recordCacheOperation).toHaveBeenCalledWith('get', 'hit');
    });

    it('should record cache miss', () => {
      service.recordCacheOperation('get', 'miss');
      expect(service.recordCacheOperation).toHaveBeenCalledWith('get', 'miss');
    });

    it('should record cache error', () => {
      service.recordCacheOperation('set', 'error');
      expect(service.recordCacheOperation).toHaveBeenCalledWith('set', 'error');
    });
  });

  describe('setCircuitBreakerState', () => {
    it('should set circuit breaker to CLOSED', () => {
      service.setCircuitBreakerState('game-catalog', 'CLOSED');
      expect(service.setCircuitBreakerState).toHaveBeenCalledWith('game-catalog', 'CLOSED');
    });

    it('should set circuit breaker to HALF_OPEN', () => {
      service.setCircuitBreakerState('payment', 'HALF_OPEN');
      expect(service.setCircuitBreakerState).toHaveBeenCalledWith('payment', 'HALF_OPEN');
    });

    it('should set circuit breaker to OPEN', () => {
      service.setCircuitBreakerState('user', 'OPEN');
      expect(service.setCircuitBreakerState).toHaveBeenCalledWith('user', 'OPEN');
    });
  });
});