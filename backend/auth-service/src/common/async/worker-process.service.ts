import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import { AsyncMetricsService } from './async-metrics.service';
import { Priority } from './priority-queue.service';

export interface WorkerTask {
  id: string;
  type: string;
  payload: any;
  priority: Priority;
  timeout?: number;
}

export interface WorkerResult {
  success: boolean;
  result?: any;
  error?: string;
  processingTime: number;
}

@Injectable()
export class WorkerProcessService extends EventEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(WorkerProcessService.name);
  private readonly workers = new Map<string, Worker>();
  private readonly taskQueue = new Map<Priority, WorkerTask[]>();
  private readonly pendingTasks = new Map<string, {
    resolve: (result: WorkerResult) => void;
    reject: (error: Error) => void;
    timeout?: NodeJS.Timeout;
  }>();

  private readonly maxWorkers: number;
  private readonly workerScript: string;
  private isShuttingDown = false;
  private taskCounter = 0;
  private distributionTimer?: NodeJS.Timeout;

  constructor(
    private readonly metricsService: AsyncMetricsService,
    maxWorkers = 4,
    workerScript = './worker-thread.js'
  ) {
    super();
    this.maxWorkers = maxWorkers;
    this.workerScript = workerScript;

    // Initialize priority queues
    this.taskQueue.set(Priority.HIGH, []);
    this.taskQueue.set(Priority.NORMAL, []);
    this.taskQueue.set(Priority.LOW, []);

    this.initializeWorkers();
    this.startTaskDistribution();
  }

  /**
   * Execute heavy operation in worker process
   */
  async executeInWorker<T>(
    taskType: string,
    payload: any,
    priority: Priority = Priority.NORMAL,
    timeout = 30000
  ): Promise<T> {
    if (this.isShuttingDown) {
      throw new Error('Worker service is shutting down');
    }

    const taskId = this.generateTaskId();
    const task: WorkerTask = {
      id: taskId,
      type: taskType,
      payload,
      priority,
      timeout,
    };

    return new Promise<T>((resolve, reject) => {
      // Set up timeout
      const timeoutHandle = timeout > 0 ? setTimeout(() => {
        this.pendingTasks.delete(taskId);
        reject(new Error(`Worker task ${taskId} timed out after ${timeout}ms`));
      }, timeout) : undefined;

      // Store promise handlers
      this.pendingTasks.set(taskId, {
        resolve: (result: WorkerResult) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          if (result.success) {
            resolve(result.result);
          } else {
            reject(new Error(result.error || 'Worker task failed'));
          }
        },
        reject: (error: Error) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          reject(error);
        },
        timeout: timeoutHandle,
      });

      // Add to appropriate priority queue
      const queue = this.taskQueue.get(priority);
      if (queue) {
        queue.push(task);
        this.logger.debug('Task queued for worker execution', {
          taskId,
          taskType,
          priority,
          queueSize: queue.length,
        });
      } else {
        this.pendingTasks.delete(taskId);
        if (timeoutHandle) clearTimeout(timeoutHandle);
        reject(new Error(`Invalid priority: ${priority}`));
      }
    });
  }

  /**
   * Execute batch of operations in parallel across workers
   */
  async executeBatchInWorkers<T>(
    tasks: Array<{
      type: string;
      payload: any;
      priority?: Priority;
    }>,
    concurrency = this.maxWorkers
  ): Promise<T[]> {
    const results: T[] = new Array(tasks.length);
    const executing: Promise<void>[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      
      const promise = this.executeWorkerTask(task, i, results);
      executing.push(promise);

      // Control concurrency
      if (executing.length >= concurrency) {
        await Promise.race(executing);
        // Remove completed promises
        for (let j = executing.length - 1; j >= 0; j--) {
          if (await this.isPromiseResolved(executing[j])) {
            executing.splice(j, 1);
          }
        }
      }
    }

    // Wait for remaining tasks
    await Promise.all(executing);
    return results;
  }

  /**
   * Get worker process metrics
   */
  getWorkerMetrics(): {
    activeWorkers: number;
    totalWorkers: number;
    queueSizes: Record<Priority, number>;
    pendingTasks: number;
    totalTasksProcessed: number;
  } {
    return {
      activeWorkers: this.workers.size,
      totalWorkers: this.maxWorkers,
      queueSizes: {
        [Priority.HIGH]: this.taskQueue.get(Priority.HIGH)?.length || 0,
        [Priority.NORMAL]: this.taskQueue.get(Priority.NORMAL)?.length || 0,
        [Priority.LOW]: this.taskQueue.get(Priority.LOW)?.length || 0,
      },
      pendingTasks: this.pendingTasks.size,
      totalTasksProcessed: this.taskCounter,
    };
  }

  /**
   * Initialize worker processes
   */
  private initializeWorkers(): void {
    for (let i = 0; i < this.maxWorkers; i++) {
      this.createWorker(`worker-${i}`);
    }
    this.logger.log(`Initialized ${this.maxWorkers} worker processes`);
  }

  /**
   * Create individual worker
   */
  private createWorker(workerId: string): void {
    try {
      const worker = new Worker(this.workerScript, {
        workerData: { workerId },
      });

      worker.on('message', (message) => {
        this.handleWorkerMessage(workerId, message);
      });

      worker.on('error', (error) => {
        this.logger.error(`Worker ${workerId} error:`, error);
        this.handleWorkerError(workerId, error);
      });

      worker.on('exit', (code) => {
        this.logger.warn(`Worker ${workerId} exited with code ${code}`);
        this.handleWorkerExit(workerId, code);
      });

      this.workers.set(workerId, worker);
      this.logger.debug(`Worker ${workerId} created successfully`);

    } catch (error) {
      this.logger.error(`Failed to create worker ${workerId}:`, error);
    }
  }

  /**
   * Handle worker message
   */
  private handleWorkerMessage(workerId: string, message: any): void {
    const { taskId, success, result, error, processingTime } = message;

    if (!taskId) {
      this.logger.warn(`Received message without taskId from worker ${workerId}`);
      return;
    }

    const pendingTask = this.pendingTasks.get(taskId);
    if (!pendingTask) {
      this.logger.warn(`Received result for unknown task ${taskId} from worker ${workerId}`);
      return;
    }

    // Record metrics
    this.metricsService.recordMetric({
      operationType: `worker_task`,
      duration: processingTime || 0,
      timestamp: new Date(),
      success,
      priority: 'normal',
    });

    // Resolve or reject the promise
    const workerResult: WorkerResult = {
      success,
      result,
      error,
      processingTime: processingTime || 0,
    };

    this.pendingTasks.delete(taskId);
    pendingTask.resolve(workerResult);

    this.logger.debug(`Task ${taskId} completed by worker ${workerId}`, {
      success,
      processingTime,
    });
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(workerId: string, error: Error): void {
    // Reject all pending tasks for this worker
    for (const [taskId, pendingTask] of this.pendingTasks.entries()) {
      pendingTask.reject(new Error(`Worker ${workerId} error: ${error.message}`));
      this.pendingTasks.delete(taskId);
    }

    // Restart worker if not shutting down
    if (!this.isShuttingDown) {
      this.workers.delete(workerId);
      setTimeout(() => {
        this.createWorker(workerId);
      }, 1000);
    }
  }

  /**
   * Handle worker exit
   */
  private handleWorkerExit(workerId: string, code: number): void {
    this.workers.delete(workerId);

    // Restart worker if not shutting down and exit was unexpected
    if (!this.isShuttingDown && code !== 0) {
      setTimeout(() => {
        this.createWorker(workerId);
      }, 1000);
    }
  }

  /**
   * Start task distribution to workers
   */
  private startTaskDistribution(): void {
    this.distributionTimer = setInterval(() => {
      if (this.isShuttingDown) return;

      // Distribute tasks by priority
      this.distributeTasks(Priority.HIGH);
      this.distributeTasks(Priority.NORMAL);
      this.distributeTasks(Priority.LOW);
    }, 100); // Check every 100ms
  }

  /**
   * Distribute tasks of specific priority
   */
  private distributeTasks(priority: Priority): void {
    const queue = this.taskQueue.get(priority);
    if (!queue || queue.length === 0) return;

    // Find available workers
    const availableWorkers = Array.from(this.workers.entries())
      .filter(([workerId]) => !this.isWorkerBusy(workerId));

    if (availableWorkers.length === 0) return;

    // Distribute tasks to available workers
    const tasksToDistribute = Math.min(queue.length, availableWorkers.length);
    
    for (let i = 0; i < tasksToDistribute; i++) {
      const task = queue.shift();
      const [workerId, worker] = availableWorkers[i];

      if (task) {
        this.sendTaskToWorker(workerId, worker, task);
      }
    }
  }

  /**
   * Check if worker is busy
   */
  private isWorkerBusy(workerId: string): boolean {
    // Simple check - in production, you'd track worker state more precisely
    return Array.from(this.pendingTasks.values())
      .some(task => (task as any).workerId === workerId);
  }

  /**
   * Send task to specific worker
   */
  private sendTaskToWorker(workerId: string, worker: Worker, task: WorkerTask): void {
    try {
      worker.postMessage({
        taskId: task.id,
        type: task.type,
        payload: task.payload,
      });

      // Mark task as assigned to this worker
      const pendingTask = this.pendingTasks.get(task.id);
      if (pendingTask) {
        (pendingTask as any).workerId = workerId;
      }

      this.taskCounter++;
      this.logger.debug(`Task ${task.id} sent to worker ${workerId}`, {
        taskType: task.type,
        priority: task.priority,
      });

    } catch (error) {
      this.logger.error(`Failed to send task ${task.id} to worker ${workerId}:`, error);
      
      // Reject the task
      const pendingTask = this.pendingTasks.get(task.id);
      if (pendingTask) {
        pendingTask.reject(new Error(`Failed to send task to worker: ${error.message}`));
        this.pendingTasks.delete(task.id);
      }
    }
  }

  /**
   * Execute worker task with error handling
   */
  private async executeWorkerTask<T>(
    task: { type: string; payload: any; priority?: Priority },
    index: number,
    results: T[]
  ): Promise<void> {
    try {
      const result = await this.executeInWorker<T>(
        task.type,
        task.payload,
        task.priority || Priority.NORMAL
      );
      results[index] = result;
    } catch (error) {
      this.logger.error(`Worker task failed at index ${index}:`, error);
      throw error;
    }
  }

  /**
   * Check if promise is resolved
   */
  private async isPromiseResolved(promise: Promise<any>): Promise<boolean> {
    try {
      await Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 0))
      ]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Graceful shutdown
   */
  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    this.logger.log('Shutting down worker processes...');

    // Clear distribution timer
    if (this.distributionTimer) {
      clearInterval(this.distributionTimer);
      this.distributionTimer = undefined;
    }

    // Reject all pending tasks
    for (const [taskId, pendingTask] of this.pendingTasks.entries()) {
      pendingTask.reject(new Error('Service is shutting down'));
      if (pendingTask.timeout) {
        clearTimeout(pendingTask.timeout);
      }
    }
    this.pendingTasks.clear();

    // Terminate all workers
    const terminationPromises = Array.from(this.workers.entries()).map(
      ([workerId, worker]) => {
        return new Promise<void>((resolve) => {
          worker.terminate().then(() => {
            this.logger.debug(`Worker ${workerId} terminated`);
            resolve();
          }).catch((error) => {
            this.logger.error(`Error terminating worker ${workerId}:`, error);
            resolve();
          });
        });
      }
    );

    await Promise.all(terminationPromises);
    this.workers.clear();
    this.logger.log('All worker processes terminated');
  }
}