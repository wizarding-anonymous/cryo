import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';

export enum Priority {
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
}

export interface QueueItem<T = any> {
  id: string;
  priority: Priority;
  data: T;
  timestamp: Date;
  retries: number;
  maxRetries: number;
  timeout?: number;
}

export interface QueueMetrics {
  totalProcessed: number;
  totalFailed: number;
  averageProcessingTime: number;
  queueSize: number;
  backpressureActive: boolean;
  priorityDistribution: Record<Priority, number>;
}

@Injectable()
export class PriorityQueueService extends EventEmitter {
  private readonly logger = new Logger(PriorityQueueService.name);
  private readonly queues = new Map<Priority, QueueItem[]>();
  private readonly processing = new Set<string>();
  private readonly metrics: QueueMetrics = {
    totalProcessed: 0,
    totalFailed: 0,
    averageProcessingTime: 0,
    queueSize: 0,
    backpressureActive: false,
    priorityDistribution: {
      [Priority.HIGH]: 0,
      [Priority.NORMAL]: 0,
      [Priority.LOW]: 0,
    },
  };

  private readonly maxQueueSize: number;
  private readonly maxConcurrentJobs: number;
  private readonly backpressureThreshold: number;
  private processingTimes: number[] = [];
  private isProcessing = false;

  constructor(
    maxQueueSize = 10000,
    maxConcurrentJobs = 100,
    backpressureThreshold = 0.8
  ) {
    super();
    this.maxQueueSize = maxQueueSize;
    this.maxConcurrentJobs = maxConcurrentJobs;
    this.backpressureThreshold = backpressureThreshold;

    // Initialize priority queues
    this.queues.set(Priority.HIGH, []);
    this.queues.set(Priority.NORMAL, []);
    this.queues.set(Priority.LOW, []);

    // Start processing loop
    this.startProcessing();
  }

  /**
   * Add item to priority queue with backpressure handling
   */
  async enqueue<T>(
    id: string,
    data: T,
    priority: Priority = Priority.NORMAL,
    maxRetries = 3,
    timeout?: number
  ): Promise<boolean> {
    // Check backpressure
    if (this.isBackpressureActive()) {
      this.logger.warn('Backpressure active, rejecting low priority items', {
        queueSize: this.getTotalQueueSize(),
        priority,
        itemId: id,
      });

      // Reject low priority items during backpressure
      if (priority === Priority.LOW) {
        this.emit('backpressure-reject', { id, priority, data });
        return false;
      }

      // Delay normal priority items
      if (priority === Priority.NORMAL) {
        await this.delay(100);
      }
    }

    // Check total queue size limit
    if (this.getTotalQueueSize() >= this.maxQueueSize) {
      this.logger.error('Queue size limit exceeded', {
        maxSize: this.maxQueueSize,
        currentSize: this.getTotalQueueSize(),
        itemId: id,
      });
      return false;
    }

    const item: QueueItem<T> = {
      id,
      priority,
      data,
      timestamp: new Date(),
      retries: 0,
      maxRetries,
      timeout,
    };

    const queue = this.queues.get(priority);
    if (!queue) {
      this.logger.error('Invalid priority level', { priority, itemId: id });
      return false;
    }

    queue.push(item);
    this.updateMetrics();

    this.logger.debug('Item enqueued', {
      itemId: id,
      priority,
      queueSize: queue.length,
      totalQueueSize: this.getTotalQueueSize(),
    });

    this.emit('item-enqueued', item);
    return true;
  }

  /**
   * Process items from queues with priority ordering
   */
  private async startProcessing(): Promise<void> {
    this.isProcessing = true;

    while (this.isProcessing) {
      try {
        // Check if we can process more items
        if (this.processing.size >= this.maxConcurrentJobs) {
          await this.delay(10);
          continue;
        }

        // Get next item by priority
        const item = this.getNextItem();
        if (!item) {
          await this.delay(10);
          continue;
        }

        // Process item asynchronously
        setImmediate(() => this.processItem(item));

      } catch (error) {
        this.logger.error('Error in processing loop', {
          error: error.message,
          stack: error.stack,
        });
        await this.delay(100);
      }
    }
  }

  /**
   * Get next item to process based on priority
   */
  private getNextItem(): QueueItem | null {
    // Process HIGH priority first
    const highQueue = this.queues.get(Priority.HIGH);
    if (highQueue && highQueue.length > 0) {
      return highQueue.shift()!;
    }

    // Then NORMAL priority
    const normalQueue = this.queues.get(Priority.NORMAL);
    if (normalQueue && normalQueue.length > 0) {
      return normalQueue.shift()!;
    }

    // Finally LOW priority (only if not under backpressure)
    if (!this.isBackpressureActive()) {
      const lowQueue = this.queues.get(Priority.LOW);
      if (lowQueue && lowQueue.length > 0) {
        return lowQueue.shift()!;
      }
    }

    return null;
  }

  /**
   * Process individual item
   */
  private async processItem(item: QueueItem): Promise<void> {
    const startTime = Date.now();
    this.processing.add(item.id);

    try {
      this.logger.debug('Processing item', {
        itemId: item.id,
        priority: item.priority,
        attempt: item.retries + 1,
      });

      // Set timeout if specified
      const timeoutPromise = item.timeout
        ? new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Processing timeout')), item.timeout)
          )
        : null;

      // Emit processing event
      const processingPromise = new Promise<void>((resolve, reject) => {
        this.emit('process-item', item, resolve, reject);
      });

      // Wait for processing or timeout
      if (timeoutPromise) {
        await Promise.race([processingPromise, timeoutPromise]);
      } else {
        await processingPromise;
      }

      // Success
      const processingTime = Date.now() - startTime;
      this.recordProcessingTime(processingTime);
      this.metrics.totalProcessed++;

      this.logger.debug('Item processed successfully', {
        itemId: item.id,
        processingTime,
        priority: item.priority,
      });

      this.emit('item-processed', item, processingTime);

    } catch (error) {
      // Handle failure
      item.retries++;
      const processingTime = Date.now() - startTime;

      this.logger.warn('Item processing failed', {
        itemId: item.id,
        error: error.message,
        attempt: item.retries,
        maxRetries: item.maxRetries,
        processingTime,
      });

      if (item.retries < item.maxRetries) {
        // Retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, item.retries - 1), 30000);
        setTimeout(() => {
          const queue = this.queues.get(item.priority);
          if (queue) {
            queue.unshift(item); // Add back to front for retry
          }
        }, delay);

        this.emit('item-retry', item, error);
      } else {
        // Max retries exceeded
        this.metrics.totalFailed++;
        this.emit('item-failed', item, error);
      }
    } finally {
      this.processing.delete(item.id);
      this.updateMetrics();
    }
  }

  /**
   * Check if backpressure should be active
   */
  private isBackpressureActive(): boolean {
    const totalSize = this.getTotalQueueSize();
    const processingRatio = this.processing.size / this.maxConcurrentJobs;
    const queueRatio = totalSize / this.maxQueueSize;

    const backpressureActive = 
      processingRatio > this.backpressureThreshold ||
      queueRatio > this.backpressureThreshold;

    this.metrics.backpressureActive = backpressureActive;
    return backpressureActive;
  }

  /**
   * Get total queue size across all priorities
   */
  private getTotalQueueSize(): number {
    return Array.from(this.queues.values())
      .reduce((total, queue) => total + queue.length, 0);
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    this.metrics.queueSize = this.getTotalQueueSize();
    
    // Update priority distribution
    this.metrics.priorityDistribution = {
      [Priority.HIGH]: this.queues.get(Priority.HIGH)?.length || 0,
      [Priority.NORMAL]: this.queues.get(Priority.NORMAL)?.length || 0,
      [Priority.LOW]: this.queues.get(Priority.LOW)?.length || 0,
    };
  }

  /**
   * Record processing time for metrics
   */
  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time);
    
    // Keep only last 1000 measurements
    if (this.processingTimes.length > 1000) {
      this.processingTimes = this.processingTimes.slice(-1000);
    }

    // Calculate average
    this.metrics.averageProcessingTime = 
      this.processingTimes.reduce((sum, t) => sum + t, 0) / this.processingTimes.length;
  }

  /**
   * Get current metrics
   */
  getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }

  /**
   * Get queue status for monitoring
   */
  getStatus(): {
    queues: Record<Priority, number>;
    processing: number;
    backpressure: boolean;
    metrics: QueueMetrics;
  } {
    return {
      queues: {
        [Priority.HIGH]: this.queues.get(Priority.HIGH)?.length || 0,
        [Priority.NORMAL]: this.queues.get(Priority.NORMAL)?.length || 0,
        [Priority.LOW]: this.queues.get(Priority.LOW)?.length || 0,
      },
      processing: this.processing.size,
      backpressure: this.isBackpressureActive(),
      metrics: this.getMetrics(),
    };
  }

  /**
   * Stop processing (for graceful shutdown)
   */
  async stop(): Promise<void> {
    this.isProcessing = false;
    
    // Wait for current processing to complete
    while (this.processing.size > 0) {
      await this.delay(100);
    }

    this.logger.log('Priority queue service stopped');
  }

  /**
   * Clear all queues
   */
  clear(): void {
    this.queues.forEach(queue => queue.length = 0);
    this.processing.clear();
    this.updateMetrics();
    this.logger.log('All queues cleared');
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}