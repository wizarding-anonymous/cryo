import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis/redis.service';
import { v4 as uuidv4 } from 'uuid';

export interface SagaStep {
  id: string;
  name: string;
  execute: () => Promise<any>;
  compensate: () => Promise<void>;
  retryCount?: number;
  maxRetries?: number;
  timeout?: number;
}

export interface SagaTransaction {
  id: string;
  name: string;
  steps: SagaStep[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'compensating' | 'compensated';
  currentStepIndex: number;
  executedSteps: string[];
  compensatedSteps: string[];
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

export interface SagaMetrics {
  totalTransactions: number;
  completedTransactions: number;
  failedTransactions: number;
  compensatedTransactions: number;
  averageExecutionTime: number;
  successRate: number;
}

@Injectable()
export class SagaService {
  private readonly logger = new Logger(SagaService.name);
  private readonly sagaTimeout: number;
  private readonly maxRetries: number;
  private readonly lockTtl: number;

  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.sagaTimeout = this.configService.get<number>('SAGA_TIMEOUT', 30000); // 30 seconds
    this.maxRetries = this.configService.get<number>('SAGA_MAX_RETRIES', 3);
    this.lockTtl = this.configService.get<number>('SAGA_LOCK_TTL', 60000); // 60 seconds
  }

  /**
   * Starts a new saga transaction
   * @param name Saga transaction name
   * @param steps Array of saga steps to execute
   * @param metadata Optional metadata for the saga
   * @returns Saga transaction ID
   */
  async startSaga(
    name: string,
    steps: Omit<SagaStep, 'id'>[],
    metadata?: Record<string, any>
  ): Promise<string> {
    const sagaId = uuidv4();
    
    const sagaSteps: SagaStep[] = steps.map((step, index) => ({
      ...step,
      id: `${sagaId}-step-${index}`,
      retryCount: 0,
      maxRetries: step.maxRetries || this.maxRetries,
      timeout: step.timeout || this.sagaTimeout,
    }));

    const saga: SagaTransaction = {
      id: sagaId,
      name,
      steps: sagaSteps,
      status: 'pending',
      currentStepIndex: 0,
      executedSteps: [],
      compensatedSteps: [],
      startedAt: new Date(),
      metadata,
    };

    // Store saga in Redis with TTL
    await this.storeSaga(saga);

    this.logger.log(`Saga started: ${name}`, {
      sagaId,
      stepsCount: steps.length,
      metadata,
    });

    // Execute saga asynchronously
    setImmediate(() => this.executeSaga(sagaId));

    return sagaId;
  }

  /**
   * Executes a saga transaction with automatic compensation on failure
   * @param sagaId Saga transaction ID
   */
  private async executeSaga(sagaId: string): Promise<void> {
    const lockKey = `saga:lock:${sagaId}`;
    const lockValue = uuidv4();

    try {
      // Acquire distributed lock to prevent concurrent execution
      const lockAcquired = await this.redis.setNX(
        lockKey,
        lockValue,
        Math.floor(this.lockTtl / 1000) // Convert to seconds
      );

      if (!lockAcquired) {
        this.logger.warn(`Saga already being executed: ${sagaId}`);
        return;
      }

      const saga = await this.getSaga(sagaId);
      if (!saga) {
        this.logger.error(`Saga not found: ${sagaId}`);
        return;
      }

      if (saga.status !== 'pending') {
        this.logger.warn(`Saga not in pending state: ${sagaId}, status: ${saga.status}`);
        return;
      }

      // Update saga status to running
      saga.status = 'running';
      await this.storeSaga(saga);

      this.logger.log(`Executing saga: ${saga.name}`, { sagaId });

      // Execute steps sequentially
      for (let i = 0; i < saga.steps.length; i++) {
        const step = saga.steps[i];
        saga.currentStepIndex = i;

        try {
          this.logger.log(`Executing step: ${step.name}`, {
            sagaId,
            stepId: step.id,
            stepIndex: i,
          });

          // Execute step with timeout and retry logic
          const result = await this.executeStepWithRetry(step);
          
          // Mark step as executed
          saga.executedSteps.push(step.id);
          await this.storeSaga(saga);

          this.logger.log(`Step completed: ${step.name}`, {
            sagaId,
            stepId: step.id,
            result: typeof result === 'object' ? JSON.stringify(result) : result,
          });

        } catch (error) {
          this.logger.error(`Step failed: ${step.name}`, {
            sagaId,
            stepId: step.id,
            error: error.message,
            stack: error.stack,
          });

          // Mark saga as failed and start compensation
          saga.status = 'failed';
          saga.error = error.message;
          await this.storeSaga(saga);

          // Start compensation process
          await this.compensate(sagaId);
          return;
        }
      }

      // All steps completed successfully
      saga.status = 'completed';
      saga.completedAt = new Date();
      await this.storeSaga(saga);

      this.logger.log(`Saga completed successfully: ${saga.name}`, {
        sagaId,
        executionTime: saga.completedAt.getTime() - saga.startedAt.getTime(),
        stepsExecuted: saga.executedSteps.length,
      });

    } catch (error) {
      this.logger.error(`Saga execution failed: ${sagaId}`, {
        error: error.message,
        stack: error.stack,
      });

      // Attempt compensation even if saga execution failed
      await this.compensate(sagaId);

    } finally {
      // Release distributed lock (simple delete - Redis service doesn't support Lua scripts)
      try {
        const currentValue = await this.redis.get(lockKey);
        if (currentValue === lockValue) {
          await this.redis.delete(lockKey);
        }
      } catch (error) {
        this.logger.error('Failed to release distributed lock', {
          lockKey,
          error: error.message,
        });
      }
    }
  }

  /**
   * Executes a step with retry logic and timeout
   * @param step Saga step to execute
   * @returns Step execution result
   */
  private async executeStepWithRetry(step: SagaStep): Promise<any> {
    let lastError: Error;

    for (let attempt = 0; attempt <= step.maxRetries!; attempt++) {
      try {
        // Execute step with timeout
        const result = await Promise.race([
          step.execute(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Step execution timeout')), step.timeout!)
          ),
        ]);

        return result;

      } catch (error) {
        lastError = error;
        step.retryCount = attempt + 1;

        if (attempt < step.maxRetries!) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff, max 10s
          this.logger.warn(`Step failed, retrying in ${delay}ms`, {
            stepId: step.id,
            stepName: step.name,
            attempt: attempt + 1,
            maxRetries: step.maxRetries,
            error: error.message,
          });

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Compensates a failed saga by executing compensation actions for completed steps
   * @param sagaId Saga transaction ID
   */
  async compensate(sagaId: string): Promise<void> {
    const saga = await this.getSaga(sagaId);
    if (!saga) {
      this.logger.error(`Saga not found for compensation: ${sagaId}`);
      return;
    }

    if (saga.status === 'compensated' || saga.status === 'compensating') {
      this.logger.warn(`Saga already compensated or compensating: ${sagaId}`);
      return;
    }

    saga.status = 'compensating';
    await this.storeSaga(saga);

    this.logger.log(`Starting compensation for saga: ${saga.name}`, {
      sagaId,
      executedSteps: saga.executedSteps.length,
    });

    // Compensate executed steps in reverse order
    const executedSteps = saga.steps.filter(step => saga.executedSteps.includes(step.id));
    
    for (let i = executedSteps.length - 1; i >= 0; i--) {
      const step = executedSteps[i];

      try {
        this.logger.log(`Compensating step: ${step.name}`, {
          sagaId,
          stepId: step.id,
        });

        await step.compensate();
        saga.compensatedSteps.push(step.id);
        await this.storeSaga(saga);

        this.logger.log(`Step compensated: ${step.name}`, {
          sagaId,
          stepId: step.id,
        });

      } catch (error) {
        this.logger.error(`Compensation failed for step: ${step.name}`, {
          sagaId,
          stepId: step.id,
          error: error.message,
          stack: error.stack,
        });

        // Continue with other compensations even if one fails
        // This ensures we attempt to clean up as much as possible
      }
    }

    saga.status = 'compensated';
    saga.completedAt = new Date();
    await this.storeSaga(saga);

    this.logger.log(`Saga compensation completed: ${saga.name}`, {
      sagaId,
      compensatedSteps: saga.compensatedSteps.length,
      totalExecutedSteps: saga.executedSteps.length,
    });
  }

  /**
   * Completes a saga manually (for external completion scenarios)
   * @param sagaId Saga transaction ID
   * @param result Optional completion result
   */
  async complete(sagaId: string, result?: any): Promise<void> {
    const saga = await this.getSaga(sagaId);
    if (!saga) {
      this.logger.error(`Saga not found for completion: ${sagaId}`);
      return;
    }

    if (saga.status === 'completed') {
      this.logger.warn(`Saga already completed: ${sagaId}`);
      return;
    }

    saga.status = 'completed';
    saga.completedAt = new Date();
    if (result) {
      saga.metadata = { ...saga.metadata, completionResult: result };
    }

    await this.storeSaga(saga);

    this.logger.log(`Saga manually completed: ${saga.name}`, {
      sagaId,
      result: result ? JSON.stringify(result) : undefined,
    });
  }

  /**
   * Gets saga transaction by ID
   * @param sagaId Saga transaction ID
   * @returns Saga transaction or null if not found
   */
  async getSaga(sagaId: string): Promise<SagaTransaction | null> {
    try {
      const sagaData = await this.redis.get(`saga:${sagaId}`);
      if (!sagaData) {
        return null;
      }

      const saga = JSON.parse(sagaData) as SagaTransaction;
      
      // Convert date strings back to Date objects
      saga.startedAt = new Date(saga.startedAt);
      if (saga.completedAt) {
        saga.completedAt = new Date(saga.completedAt);
      }

      return saga;
    } catch (error) {
      this.logger.error(`Failed to get saga: ${sagaId}`, {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Stores saga transaction in Redis
   * @param saga Saga transaction to store
   */
  private async storeSaga(saga: SagaTransaction): Promise<void> {
    try {
      // Store saga with TTL (24 hours for completed/compensated, 1 hour for others)
      const ttl = ['completed', 'compensated', 'failed'].includes(saga.status) 
        ? 24 * 60 * 60 // 24 hours
        : 60 * 60; // 1 hour

      await this.redis.set(
        `saga:${saga.id}`,
        JSON.stringify(saga),
        ttl
      );
    } catch (error) {
      this.logger.error(`Failed to store saga: ${saga.id}`, {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Gets saga metrics for monitoring
   * @returns Saga execution metrics
   */
  async getMetrics(): Promise<SagaMetrics> {
    try {
      const keys = await this.redis.keys('saga:*');
      const sagas: SagaTransaction[] = [];

      // Get all sagas (in batches to avoid memory issues)
      const batchSize = 100;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        const sagaDataList = await this.redis.mget(...batch);
        
        for (const sagaData of sagaDataList) {
          if (sagaData) {
            try {
              const saga = JSON.parse(sagaData) as SagaTransaction;
              sagas.push(saga);
            } catch (error) {
              // Skip invalid saga data
            }
          }
        }
      }

      const totalTransactions = sagas.length;
      const completedTransactions = sagas.filter(s => s.status === 'completed').length;
      const failedTransactions = sagas.filter(s => s.status === 'failed').length;
      const compensatedTransactions = sagas.filter(s => s.status === 'compensated').length;

      // Calculate average execution time for completed sagas
      const completedSagas = sagas.filter(s => s.status === 'completed' && s.completedAt);
      const totalExecutionTime = completedSagas.reduce((sum, saga) => {
        const startTime = new Date(saga.startedAt).getTime();
        const endTime = new Date(saga.completedAt!).getTime();
        return sum + (endTime - startTime);
      }, 0);
      const averageExecutionTime = completedSagas.length > 0 
        ? totalExecutionTime / completedSagas.length 
        : 0;

      const successRate = totalTransactions > 0 
        ? (completedTransactions / totalTransactions) * 100 
        : 0;

      return {
        totalTransactions,
        completedTransactions,
        failedTransactions,
        compensatedTransactions,
        averageExecutionTime,
        successRate,
      };
    } catch (error) {
      this.logger.error('Failed to get saga metrics', {
        error: error.message,
      });

      return {
        totalTransactions: 0,
        completedTransactions: 0,
        failedTransactions: 0,
        compensatedTransactions: 0,
        averageExecutionTime: 0,
        successRate: 0,
      };
    }
  }

  /**
   * Cleans up old saga transactions
   * @param olderThanHours Remove sagas older than specified hours
   */
  async cleanup(olderThanHours: number = 24): Promise<number> {
    try {
      const keys = await this.redis.keys('saga:*');
      let deletedCount = 0;
      const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

      for (const key of keys) {
        try {
          const sagaData = await this.redis.get(key);
          if (sagaData) {
            const saga = JSON.parse(sagaData) as SagaTransaction;
            const sagaTime = saga.completedAt || saga.startedAt;
            
            if (new Date(sagaTime) < cutoffTime) {
              await this.redis.delete(key);
              deletedCount++;
            }
          }
        } catch (error) {
          // Delete invalid saga data
          await this.redis.delete(key);
          deletedCount++;
        }
      }

      this.logger.log(`Cleaned up ${deletedCount} old saga transactions`, {
        olderThanHours,
        cutoffTime,
      });

      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup saga transactions', {
        error: error.message,
      });
      return 0;
    }
  }
}