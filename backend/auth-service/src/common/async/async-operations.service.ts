import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PriorityQueueService, Priority } from './priority-queue.service';
import { EventEmitter } from 'events';

// Re-export Priority for external use
export { Priority } from './priority-queue.service';

export interface AsyncOperation {
    id: string;
    type: string;
    payload: any;
    priority: Priority;
    timeout?: number;
    maxRetries?: number;
}

export interface AsyncOperationResult {
    success: boolean;
    result?: any;
    error?: string;
    processingTime: number;
    createdAt?: number;
}

@Injectable()
export class AsyncOperationsService extends EventEmitter implements OnModuleDestroy {
    private readonly logger = new Logger(AsyncOperationsService.name);
    private readonly operations = new Map<string, (payload: any) => Promise<any>>();
    private readonly results = new Map<string, AsyncOperationResult>();
    private readonly resultTTL = 300000; // 5 minutes
    private cleanupTimer?: NodeJS.Timeout;

    constructor(private readonly priorityQueue: PriorityQueueService) {
        super();
        this.setupQueueHandlers();
        this.startResultCleanup();
    }

    /**
     * Register an async operation handler
     */
    registerOperation(
        type: string,
        handler: (payload: any) => Promise<any>
    ): void {
        this.operations.set(type, handler);
        this.logger.log(`Registered async operation: ${type}`);
    }

    /**
     * Execute operation asynchronously with priority
     */
    async executeAsync(
        operation: AsyncOperation
    ): Promise<string> {
        const operationId = operation.id || this.generateId();

        const success = await this.priorityQueue.enqueue(
            operationId,
            operation,
            operation.priority,
            operation.maxRetries || 3,
            operation.timeout
        );

        if (!success) {
            throw new Error('Failed to enqueue operation due to backpressure or queue limits');
        }

        this.logger.debug('Operation enqueued for async execution', {
            operationId,
            type: operation.type,
            priority: operation.priority,
        });

        return operationId;
    }

    /**
     * Execute operation using setImmediate for non-blocking execution
     */
    executeImmediate<T>(
        operation: () => Promise<T> | T,
        priority: Priority = Priority.NORMAL
    ): void {
        setImmediate(async () => {
            try {
                await operation();
            } catch (error) {
                this.logger.error('Immediate operation failed', {
                    error: error.message,
                    priority,
                    stack: error.stack,
                });
                this.emit('immediate-operation-error', error);
            }
        });
    }

    /**
     * Execute multiple operations in parallel with concurrency control
     */
    async executeParallel<T>(
        operations: (() => Promise<T>)[],
        concurrency = 10,
        priority: Priority = Priority.NORMAL
    ): Promise<T[]> {
        const results: T[] = [];
        const executing: Promise<void>[] = [];

        for (let i = 0; i < operations.length; i++) {
            const operation = operations[i];

            const promise = this.executeWithConcurrencyControl(
                operation,
                i,
                results,
                priority
            );

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

        // Wait for remaining operations
        await Promise.all(executing);
        return results;
    }

    /**
     * Get result of async operation
     */
    getResult(operationId: string): AsyncOperationResult | null {
        return this.results.get(operationId) || null;
    }

    /**
     * Wait for operation completion with timeout
     */
    async waitForResult(
        operationId: string,
        timeout = 30000
    ): Promise<AsyncOperationResult> {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Operation ${operationId} timed out after ${timeout}ms`));
            }, timeout);

            const checkResult = () => {
                const result = this.results.get(operationId);
                if (result) {
                    clearTimeout(timeoutId);
                    resolve(result);
                } else {
                    setTimeout(checkResult, 100);
                }
            };

            checkResult();
        });
    }

    /**
     * Execute critical path operations (authentication flow)
     */
    async executeCriticalPath<T>(
        operation: () => Promise<T>,
        fallback?: () => Promise<T>
    ): Promise<T> {
        const startTime = Date.now();

        try {
            // Execute with high priority and short timeout
            const result = await Promise.race([
                operation(),
                this.createTimeoutPromise<T>(5000) // 5 second timeout for critical path
            ]);

            const duration = Date.now() - startTime;
            this.emit('critical-path-success', { duration });

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.logger.warn('Critical path operation failed', {
                error: error.message,
                duration,
                hasFallback: !!fallback,
            });

            if (fallback) {
                try {
                    const result = await fallback();
                    this.emit('critical-path-fallback-success', { duration });
                    return result;
                } catch (fallbackError) {
                    this.logger.error('Critical path fallback also failed', {
                        originalError: error.message,
                        fallbackError: fallbackError.message,
                        duration,
                    });
                    throw fallbackError;
                }
            }

            this.emit('critical-path-failure', { error, duration });
            throw error;
        }
    }

    /**
     * Batch operations for efficiency
     */
    async executeBatch<T>(
        operations: (() => Promise<T>)[],
        batchSize = 50,
        priority: Priority = Priority.NORMAL
    ): Promise<T[]> {
        const results: T[] = [];

        for (let i = 0; i < operations.length; i += batchSize) {
            const batch = operations.slice(i, i + batchSize);
            const batchResults = await this.executeParallel(batch, batchSize, priority);
            results.push(...batchResults);

            // Small delay between batches to prevent overwhelming
            if (i + batchSize < operations.length) {
                await this.delay(10);
            }
        }

        return results;
    }

    /**
     * Setup queue event handlers
     */
    private setupQueueHandlers(): void {
        this.priorityQueue.on('process-item', async (item, resolve, reject) => {
            try {
                const operation = item.data as AsyncOperation;
                const handler = this.operations.get(operation.type);

                if (!handler) {
                    throw new Error(`No handler registered for operation type: ${operation.type}`);
                }

                const startTime = Date.now();
                const result = await handler(operation.payload);
                const processingTime = Date.now() - startTime;

                // Store result with timestamp for TTL cleanup
                this.results.set(item.id, {
                    success: true,
                    result,
                    processingTime,
                    createdAt: Date.now(),
                });

                this.emit('operation-completed', {
                    operationId: item.id,
                    type: operation.type,
                    processingTime,
                });

                resolve();
            } catch (error) {
                const processingTime = Date.now() - Date.now();

                // Store error result with timestamp for TTL cleanup
                this.results.set(item.id, {
                    success: false,
                    error: error.message,
                    processingTime,
                    createdAt: Date.now(),
                });

                this.emit('operation-failed', {
                    operationId: item.id,
                    error: error.message,
                    processingTime,
                });

                reject(error);
            }
        });

        this.priorityQueue.on('item-failed', (item, error) => {
            this.logger.error('Operation permanently failed', {
                operationId: item.id,
                type: item.data.type,
                error: error.message,
                retries: item.retries,
            });
        });

        this.priorityQueue.on('backpressure-reject', (item) => {
            this.logger.warn('Operation rejected due to backpressure', {
                operationId: item.id,
                priority: item.priority,
            });

            this.results.set(item.id, {
                success: false,
                error: 'Rejected due to system backpressure',
                processingTime: 0,
                createdAt: Date.now(),
            });
        });
    }

    /**
     * Execute operation with concurrency control
     */
    private async executeWithConcurrencyControl<T>(
        operation: () => Promise<T>,
        index: number,
        results: T[],
        priority: Priority
    ): Promise<void> {
        try {
            const result = await operation();
            results[index] = result;
        } catch (error) {
            this.logger.error('Parallel operation failed', {
                index,
                priority,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Check if promise is resolved (utility)
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
     * Create timeout promise
     */
    private createTimeoutPromise<T>(ms: number): Promise<T> {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
        });
    }

    /**
     * Start cleanup of old results
     */
    private startResultCleanup(): void {
        this.cleanupTimer = setInterval(() => {
            const now = Date.now();
            const toDelete: string[] = [];

            // Clean up based on TTL and map size to prevent memory issues
            for (const [id, result] of this.results.entries()) {
                // Check if result is older than TTL
                const resultAge = now - ((result as any).createdAt || 0);
                if (resultAge > this.resultTTL) {
                    toDelete.push(id);
                }
            }

            // Also clean up based on map size to prevent memory issues
            if (this.results.size > 10000) {
                // Get oldest entries (first 1000) and mark for deletion
                let count = 0;
                for (const [id] of this.results.entries()) {
                    if (count >= 1000) break;
                    if (!toDelete.includes(id)) {
                        toDelete.push(id);
                    }
                    count++;
                }
            }

            // Remove oldest results
            toDelete.forEach(id => this.results.delete(id));

            if (toDelete.length > 0) {
                this.logger.debug('Cleaned up old operation results', {
                    cleaned: toDelete.length,
                    remaining: this.results.size,
                    ttlCleanup: true,
                });
            }
        }, 60000); // Clean up every minute
    }

    /**
     * Generate unique operation ID
     */
    private generateId(): string {
        return `op_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * Utility delay function
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get service metrics
     */
    getMetrics(): {
        queueMetrics: any;
        operationTypes: string[];
        resultsStored: number;
    } {
        return {
            queueMetrics: this.priorityQueue.getMetrics(),
            operationTypes: Array.from(this.operations.keys()),
            resultsStored: this.results.size,
        };
    }

    /**
     * Graceful shutdown
     */
    async shutdown(): Promise<void> {
        this.logger.log('Shutting down async operations service');
        await this.priorityQueue.stop();
        this.results.clear();
    }

    /**
     * Cleanup timers when module is destroyed
     */
    onModuleDestroy(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
        this.logger.log('AsyncOperationsService timers cleaned up');
    }
}