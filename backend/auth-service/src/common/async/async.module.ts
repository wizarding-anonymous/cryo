import { Module, Global } from '@nestjs/common';
import { PriorityQueueService } from './priority-queue.service';
import { AsyncOperationsService } from './async-operations.service';
import { AsyncMetricsService } from './async-metrics.service';
import { WorkerProcessService } from './worker-process.service';
import { AsyncMonitoringController } from './async-monitoring.controller';

@Global()
@Module({
  controllers: [AsyncMonitoringController],
  providers: [
    {
      provide: PriorityQueueService,
      useFactory: () => {
        // Configure based on environment
        const maxQueueSize = parseInt(process.env.MAX_QUEUE_SIZE || '10000');
        const maxConcurrentJobs = parseInt(process.env.MAX_CONCURRENT_JOBS || '100');
        const backpressureThreshold = parseFloat(process.env.BACKPRESSURE_THRESHOLD || '0.8');
        
        return new PriorityQueueService(maxQueueSize, maxConcurrentJobs, backpressureThreshold);
      },
    },
    AsyncOperationsService,
    AsyncMetricsService,
    {
      provide: WorkerProcessService,
      useFactory: (metricsService: AsyncMetricsService) => {
        const maxWorkers = parseInt(process.env.MAX_WORKER_PROCESSES || '4');
        const workerScript = process.env.WORKER_SCRIPT_PATH || './worker-thread.js';
        
        // Log configuration for debugging
        console.log(`WorkerProcessService configuration: maxWorkers=${maxWorkers}, workerScript=${workerScript}`);
        
        return new WorkerProcessService(metricsService, maxWorkers, workerScript);
      },
      inject: [AsyncMetricsService],
    },
  ],
  exports: [
    PriorityQueueService,
    AsyncOperationsService,
    AsyncMetricsService,
    WorkerProcessService,
  ],
})
export class AsyncModule {}