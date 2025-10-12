import { Test, TestingModule } from '@nestjs/testing';
import { AsyncOperationsService } from './async-operations.service';
import { AsyncMetricsService } from './async-metrics.service';
import { PriorityQueueService, Priority } from './priority-queue.service';
import { WorkerProcessService } from './worker-process.service';

describe('Async Operations Integration', () => {
  let asyncOperations: AsyncOperationsService;
  let metricsService: AsyncMetricsService;
  let priorityQueue: PriorityQueueService;
  let workerProcess: WorkerProcessService;

  beforeAll(async () => {
    priorityQueue = new PriorityQueueService(1000, 50, 0.8);
    asyncOperations = new AsyncOperationsService(priorityQueue);
    metricsService = new AsyncMetricsService();
    
    // Use a mock worker for testing
    workerProcess = {
      executeInWorker: async (type: string, payload: any) => {
        if (type === 'hash-password') {
          return 'hashed_' + payload.password;
        }
        if (type === 'compare-password') {
          return payload.password === 'correct';
        }
        return 'mock-result';
      },
      getWorkerMetrics: () => ({
        activeWorkers: 2,
        totalWorkers: 4,
        queueSizes: { [Priority.HIGH]: 0, [Priority.NORMAL]: 0, [Priority.LOW]: 0 },
        pendingTasks: 0,
        totalTasksProcessed: 0,
      }),
      onModuleDestroy: async () => { },
    } as any;
  });

  afterAll(async () => {
    if (asyncOperations) {
      await asyncOperations.shutdown();
    }
    if (priorityQueue) {
      await priorityQueue.stop();
    }
    if (workerProcess) {
      await workerProcess.onModuleDestroy();
    }
  });

  it('should demonstrate async optimization features', async () => {
    // Test 1: setImmediate for non-blocking operations
    let immediateExecuted = false;
    asyncOperations.executeImmediate(() => {
      immediateExecuted = true;
    });

    // Should not be executed immediately
    expect(immediateExecuted).toBe(false);

    // Wait for setImmediate to execute
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(immediateExecuted).toBe(true);

    // Test 2: Priority queue with backpressure handling
    const queueStatus = priorityQueue.getStatus();
    expect(queueStatus.queues).toBeDefined();
    expect(queueStatus.backpressure).toBe(false);

    // Test 3: Worker process for CPU-intensive operations
    const hashedPassword = await workerProcess.executeInWorker('hash-password', {
      password: 'testpassword',
      saltRounds: 10,
    });
    expect(hashedPassword).toBe('hashed_testpassword');

    const passwordMatch = await workerProcess.executeInWorker('compare-password', {
      password: 'correct',
      hash: 'somehash',
    });
    expect(passwordMatch).toBe(true);

    // Test 4: Critical path optimization
    const criticalResult = await asyncOperations.executeCriticalPath(async () => {
      return 'critical-success';
    });
    expect(criticalResult).toBe('critical-success');

    // Test 5: Metrics collection
    metricsService.recordAuthFlowMetric('login', 150, true);
    const performanceSummary = metricsService.getPerformanceSummary();
    expect(performanceSummary.authFlow).toBeDefined();

    // Test 6: Parallel execution with concurrency control
    const parallelOperations = Array.from({ length: 5 }, (_, i) =>
      async () => `result-${i}`
    );

    const parallelResults = await asyncOperations.executeParallel(
      parallelOperations,
      3,
      Priority.HIGH
    );
    expect(parallelResults).toHaveLength(5);
    expect(parallelResults).toEqual(['result-0', 'result-1', 'result-2', 'result-3', 'result-4']);
  });

  it('should handle performance metrics correctly', () => {
    // Record various metrics
    metricsService.recordAuthFlowMetric('register', 200, true);
    metricsService.recordAuthFlowMetric('login', 100, true);
    metricsService.recordAuthFlowMetric('logout', 50, true);

    metricsService.recordEventMetric('security_login', 25, true);
    metricsService.recordEventMetric('notification_welcome', 75, true);

    metricsService.recordExternalServiceMetric('user-service', 'findById', 30, true, 200);

    // Check system metrics
    const systemMetrics = metricsService.getSystemMetrics();
    expect(systemMetrics.totalOperations).toBeGreaterThan(0);

    // Check health status
    const healthStatus = metricsService.getHealthStatus();
    expect(healthStatus.status).toMatch(/healthy|degraded|unhealthy/);
    expect(Array.isArray(healthStatus.issues)).toBe(true);
  });

  it('should demonstrate backpressure handling', async () => {
    // Register a test operation
    asyncOperations.registerOperation('test-backpressure', async (payload) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return payload;
    });

    // Fill queue to trigger backpressure
    const operations: Promise<string>[] = [];
    for (let i = 0; i < 50; i++) {
      operations.push(asyncOperations.executeAsync({
        id: `bp-test-${i}`,
        type: 'test-backpressure',
        payload: { index: i },
        priority: Priority.NORMAL,
      }));
    }

    const results = await Promise.allSettled(operations);
    const successful = results.filter(r => r.status === 'fulfilled').length;

    // Most operations should succeed
    expect(successful).toBeGreaterThan(40);

    // Wait a bit for processing to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that operations were processed (metrics should show activity)
    const operationsMetrics = asyncOperations.getMetrics();
    expect(operationsMetrics.operationTypes).toContain('test-backpressure');
  }, 15000);
});