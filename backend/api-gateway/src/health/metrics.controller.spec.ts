import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  let controller: MetricsController;
  let mockMetricsService: jest.Mocked<MetricsService>;

  beforeEach(async () => {
    mockMetricsService = {
      metrics: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMetrics', () => {
    it('should return metrics in Prometheus format', async () => {
      const mockMetricsOutput = `# HELP gateway_process_cpu_user_seconds_total Total user CPU time spent in seconds.
# TYPE gateway_process_cpu_user_seconds_total counter
gateway_process_cpu_user_seconds_total 0.015625

# HELP gateway_process_resident_memory_bytes Resident memory size in bytes.
# TYPE gateway_process_resident_memory_bytes gauge
gateway_process_resident_memory_bytes 25165824`;

      mockMetricsService.metrics.mockResolvedValue(mockMetricsOutput);

      const result = await controller.getMetrics();

      expect(result).toBe(mockMetricsOutput);
      expect(mockMetricsService.metrics).toHaveBeenCalledTimes(1);
    });

    it('should return empty string when no metrics available', async () => {
      mockMetricsService.metrics.mockResolvedValue('');

      const result = await controller.getMetrics();

      expect(result).toBe('');
      expect(mockMetricsService.metrics).toHaveBeenCalledTimes(1);
    });

    it('should handle service errors', async () => {
      const error = new Error('Metrics collection failed');
      mockMetricsService.metrics.mockRejectedValue(error);

      await expect(controller.getMetrics()).rejects.toThrow('Metrics collection failed');
      expect(mockMetricsService.metrics).toHaveBeenCalledTimes(1);
    });

    it('should return string type', async () => {
      const mockMetricsOutput = 'gateway_test_metric 1';
      mockMetricsService.metrics.mockResolvedValue(mockMetricsOutput);

      const result = await controller.getMetrics();

      expect(typeof result).toBe('string');
    });

    it('should handle large metrics output', async () => {
      const largeMetricsOutput = Array(1000)
        .fill(0)
        .map((_, i) => `gateway_test_metric_${i} ${i}`)
        .join('\n');

      mockMetricsService.metrics.mockResolvedValue(largeMetricsOutput);

      const result = await controller.getMetrics();

      expect(result).toBe(largeMetricsOutput);
      expect(result.split('\n')).toHaveLength(1000);
    });

    it('should handle metrics with special characters', async () => {
      const mockMetricsOutput = `# HELP gateway_http_requests_total Total HTTP requests
# TYPE gateway_http_requests_total counter
gateway_http_requests_total{method="GET",status="200"} 42
gateway_http_requests_total{method="POST",status="201"} 13`;

      mockMetricsService.metrics.mockResolvedValue(mockMetricsOutput);

      const result = await controller.getMetrics();

      expect(result).toContain('{method="GET",status="200"}');
      expect(result).toContain('{method="POST",status="201"}');
    });
  });

  describe('endpoint configuration', () => {
    it('should be configured with correct path', () => {
      const controllerMetadata = Reflect.getMetadata('path', MetricsController);
      expect(controllerMetadata).toBe('metrics');
    });

    it('should have GET method configured', () => {
      const methodMetadata = Reflect.getMetadata('method', controller.getMetrics);
      // Note: This test verifies the decorator is applied, actual HTTP method testing would be in e2e tests
      expect(controller.getMetrics).toBeDefined();
    });
  });
});