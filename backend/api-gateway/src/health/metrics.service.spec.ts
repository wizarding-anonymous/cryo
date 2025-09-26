import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';
import { Registry } from 'prom-client';

// Mock prom-client
jest.mock('prom-client', () => {
  const mockRegistry = {
    metrics: jest.fn(),
  };
  
  return {
    Registry: jest.fn(() => mockRegistry),
    collectDefaultMetrics: jest.fn(),
  };
});

describe('MetricsService', () => {
  let service: MetricsService;
  let mockRegistry: jest.Mocked<Registry>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
    
    // Get the mocked registry instance
    mockRegistry = (service as any).registry;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize registry and collect default metrics', () => {
      const { Registry, collectDefaultMetrics } = require('prom-client');
      
      expect(Registry).toHaveBeenCalled();
      expect(collectDefaultMetrics).toHaveBeenCalledWith({
        register: expect.any(Object),
        prefix: 'gateway_',
      });
    });
  });

  describe('metrics', () => {
    it('should return metrics from registry', async () => {
      const mockMetricsOutput = `# HELP gateway_process_cpu_user_seconds_total Total user CPU time spent in seconds.
# TYPE gateway_process_cpu_user_seconds_total counter
gateway_process_cpu_user_seconds_total 0.015625

# HELP gateway_process_cpu_system_seconds_total Total system CPU time spent in seconds.
# TYPE gateway_process_cpu_system_seconds_total counter
gateway_process_cpu_system_seconds_total 0.015625

# HELP gateway_process_cpu_seconds_total Total user and system CPU time spent in seconds.
# TYPE gateway_process_cpu_seconds_total counter
gateway_process_cpu_seconds_total 0.03125`;

      mockRegistry.metrics.mockResolvedValue(mockMetricsOutput);

      const result = await service.metrics();

      expect(result).toBe(mockMetricsOutput);
      expect(mockRegistry.metrics).toHaveBeenCalledTimes(1);
    });

    it('should handle empty metrics', async () => {
      mockRegistry.metrics.mockResolvedValue('');

      const result = await service.metrics();

      expect(result).toBe('');
      expect(mockRegistry.metrics).toHaveBeenCalledTimes(1);
    });

    it('should handle registry errors', async () => {
      const error = new Error('Registry error');
      mockRegistry.metrics.mockRejectedValue(error);

      await expect(service.metrics()).rejects.toThrow('Registry error');
      expect(mockRegistry.metrics).toHaveBeenCalledTimes(1);
    });

    it('should return string format suitable for Prometheus', async () => {
      const mockMetricsOutput = `# HELP gateway_nodejs_heap_size_total_bytes Process heap size from Node.js in bytes.
# TYPE gateway_nodejs_heap_size_total_bytes gauge
gateway_nodejs_heap_size_total_bytes 7159808`;

      mockRegistry.metrics.mockResolvedValue(mockMetricsOutput);

      const result = await service.metrics();

      expect(typeof result).toBe('string');
      expect(result).toContain('# HELP');
      expect(result).toContain('# TYPE');
      expect(result).toContain('gateway_');
    });

    it('should handle multiple metrics', async () => {
      const mockMetricsOutput = `# HELP gateway_process_cpu_user_seconds_total Total user CPU time spent in seconds.
# TYPE gateway_process_cpu_user_seconds_total counter
gateway_process_cpu_user_seconds_total 0.015625

# HELP gateway_process_resident_memory_bytes Resident memory size in bytes.
# TYPE gateway_process_resident_memory_bytes gauge
gateway_process_resident_memory_bytes 25165824

# HELP gateway_nodejs_eventloop_lag_seconds Lag of event loop in seconds.
# TYPE gateway_nodejs_eventloop_lag_seconds gauge
gateway_nodejs_eventloop_lag_seconds 0.001`;

      mockRegistry.metrics.mockResolvedValue(mockMetricsOutput);

      const result = await service.metrics();

      expect(result).toContain('gateway_process_cpu_user_seconds_total');
      expect(result).toContain('gateway_process_resident_memory_bytes');
      expect(result).toContain('gateway_nodejs_eventloop_lag_seconds');
    });
  });
});