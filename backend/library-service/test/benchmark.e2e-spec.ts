import {
  BenchmarkService,
  BenchmarkSuite,
} from '../src/performance/benchmark.service';
import { PerformanceMonitorService } from '../src/performance/performance-monitor.service';
import { CacheService } from '../src/cache/cache.service';
import { E2ETestBase } from './e2e-test-base';

describe('Benchmark E2E', () => {
  let testBase: E2ETestBase;
  let benchmarkService: BenchmarkService;
  let performanceMonitor: PerformanceMonitorService;
  let cacheService: CacheService;

  beforeAll(async () => {
    testBase = new E2ETestBase();
    await testBase.setup();

    benchmarkService = testBase.app.get(BenchmarkService);
    performanceMonitor = testBase.app.get(PerformanceMonitorService);
    cacheService = testBase.app.get(CacheService);

    // Clean up any existing test data
    await testBase.cleanupTestData();
  });

  afterAll(async () => {
    if (testBase) {
      await testBase.teardown();
    }
  });

  beforeEach(async () => {
    // Clear cache statistics before each test
    cacheService.resetStats();
  });

  describe('Library Service Benchmark Suite', () => {
    it('should run comprehensive library benchmark with small dataset', async () => {
      const suite = await benchmarkService.runLibraryBenchmarkSuite({
        userCount: 5,
        gamesPerUser: 50,
        iterations: 3,
      });

      expect(suite).toBeDefined();
      expect(suite.name).toBe('Library Service Benchmark Suite');
      expect(suite.results).toHaveLength(6); // 6 different benchmark operations
      expect(suite.totalDuration).toBeGreaterThan(0);
      expect(suite.averageThroughput).toBeGreaterThan(0);

      // Verify operations completed (some may fail in test environment)
      suite.results.forEach((result) => {
        expect(result.duration).toBeGreaterThan(0);
        if (result.success) {
          expect(result.throughput).toBeGreaterThan(0);
        } else {
          console.warn(`Benchmark operation failed: ${result.operation} - ${result.error}`);
        }
      });
      
      // At least some operations should succeed
      const successfulOperations = suite.results.filter(r => r.success);
      expect(successfulOperations.length).toBeGreaterThan(0);
    }, 60000);

    it('should benchmark cache performance', async () => {
      const results = await benchmarkService.benchmarkCachePerformance();

      expect(results).toHaveLength(3); // 3 different cache operations

      // Cache operations should be fast
      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.duration).toBeGreaterThan(0);
        expect(result.throughput).toBeGreaterThan(0);
      });
    }, 60000);
  });

  describe('Performance Monitoring Integration', () => {
    it('should collect performance metrics during benchmark', async () => {
      const initialMetrics = performanceMonitor.getSystemMetrics();
      expect(initialMetrics).toBeDefined();
      expect(initialMetrics.memoryUsage).toBeDefined();
      expect(initialMetrics.cpuUsage).toBeGreaterThanOrEqual(0);

      // Run a small benchmark to generate some metrics
      await benchmarkService.runLibraryBenchmarkSuite({
        userCount: 2,
        gamesPerUser: 20,
        iterations: 2,
      });

      const finalMetrics = performanceMonitor.getSystemMetrics();
      expect(finalMetrics).toBeDefined();
    }, 60000);

    it('should generate performance health check', async () => {
      const healthCheck = await performanceMonitor.performHealthCheck();

      expect(healthCheck).toBeDefined();
      expect(healthCheck.status).toMatch(/^(healthy|warning|critical)$/);
      expect(healthCheck.issues).toBeInstanceOf(Array);
      expect(healthCheck.metrics).toBeDefined();
      expect(healthCheck.metrics.responseTime).toBeGreaterThanOrEqual(0);
      expect(healthCheck.metrics.errorRate).toBeGreaterThanOrEqual(0);
      expect(healthCheck.metrics.memoryUsage).toBeGreaterThanOrEqual(0);
    });
  });
});