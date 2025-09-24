import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Graceful shutdown service for production readiness
 * Features:
 * - Signal handling (SIGTERM, SIGINT)
 * - Connection cleanup
 * - Graceful request completion
 * - Health check disabling
 * - Resource cleanup
 */

export interface ShutdownHandler {
  name: string;
  handler: () => Promise<void>;
  timeout?: number;
}

@Injectable()
export class GracefulShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(GracefulShutdownService.name);
  private readonly shutdownHandlers: ShutdownHandler[] = [];
  private isShuttingDown = false;
  private shutdownTimeout: number;

  constructor(private readonly configService: ConfigService) {
    this.shutdownTimeout = this.configService.get<number>(
      'server.shutdownTimeout',
      30000,
    );
    this.setupSignalHandlers();
  }

  /**
   * Register a shutdown handler
   */
  registerShutdownHandler(handler: ShutdownHandler): void {
    this.shutdownHandlers.push(handler);
    this.logger.debug(`Registered shutdown handler: ${handler.name}`);
  }

  /**
   * Check if the service is shutting down
   */
  isShutdown(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    // Handle SIGTERM (Docker, Kubernetes)
    process.on('SIGTERM', () => {
      this.logger.log('Received SIGTERM signal, starting graceful shutdown...');
      this.initiateShutdown('SIGTERM');
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      this.logger.log('Received SIGINT signal, starting graceful shutdown...');
      this.initiateShutdown('SIGINT');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error(
        'Uncaught exception, initiating emergency shutdown',
        error.stack,
      );
      this.emergencyShutdown(error);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error(
        'Unhandled promise rejection, initiating emergency shutdown',
        {
          reason,
          promise,
        },
      );
      this.emergencyShutdown(
        new Error(`Unhandled promise rejection: ${reason}`),
      );
    });
  }

  /**
   * Initiate graceful shutdown
   */
  private async initiateShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Shutdown already in progress, ignoring signal');
      return;
    }

    this.isShuttingDown = true;
    this.logger.log(`Starting graceful shutdown (signal: ${signal})`);

    // Set a timeout for the entire shutdown process
    const shutdownTimer = setTimeout(() => {
      this.logger.error('Shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, this.shutdownTimeout);

    try {
      // Execute shutdown handlers in reverse order (LIFO)
      const handlers = [...this.shutdownHandlers].reverse();

      for (const handler of handlers) {
        const handlerTimeout = handler.timeout || 5000;

        try {
          this.logger.log(`Executing shutdown handler: ${handler.name}`);

          await Promise.race([
            handler.handler(),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error(`Handler timeout: ${handler.name}`)),
                handlerTimeout,
              ),
            ),
          ]);

          this.logger.log(`Completed shutdown handler: ${handler.name}`);
        } catch (error) {
          this.logger.error(
            `Error in shutdown handler ${handler.name}:`,
            error,
          );
          // Continue with other handlers even if one fails
        }
      }

      this.logger.log('Graceful shutdown completed successfully');
      clearTimeout(shutdownTimer);
      process.exit(0);
    } catch (error) {
      this.logger.error('Error during graceful shutdown:', error);
      clearTimeout(shutdownTimer);
      process.exit(1);
    }
  }

  /**
   * Emergency shutdown for critical errors
   */
  private emergencyShutdown(error: Error): void {
    this.logger.error('Emergency shutdown initiated', error.stack);

    // Try to log the error and exit quickly
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }

  /**
   * NestJS lifecycle hook
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    if (signal && !this.isShuttingDown) {
      this.logger.log(
        `Application shutdown hook called with signal: ${signal}`,
      );
      await this.initiateShutdown(signal);
    }
  }

  /**
   * Create common shutdown handlers
   */
  static createDatabaseShutdownHandler(dataSource: any): ShutdownHandler {
    return {
      name: 'Database Connection',
      timeout: 10000,
      handler: async () => {
        if (dataSource && dataSource.isInitialized) {
          await dataSource.destroy();
        }
      },
    };
  }

  static createRedisShutdownHandler(redisClient: any): ShutdownHandler {
    return {
      name: 'Redis Connection',
      timeout: 5000,
      handler: async () => {
        if (redisClient && redisClient.isOpen) {
          await redisClient.quit();
        }
      },
    };
  }

  static createHttpServerShutdownHandler(server: any): ShutdownHandler {
    return {
      name: 'HTTP Server',
      timeout: 15000,
      handler: async () => {
        return new Promise<void>((resolve, reject) => {
          if (!server) {
            resolve();
            return;
          }

          server.close((error: Error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
      },
    };
  }

  static createKafkaShutdownHandler(kafkaClient: any): ShutdownHandler {
    return {
      name: 'Kafka Client',
      timeout: 10000,
      handler: async () => {
        if (kafkaClient) {
          await kafkaClient.disconnect();
        }
      },
    };
  }

  static createCacheShutdownHandler(cacheManager: any): ShutdownHandler {
    return {
      name: 'Cache Manager',
      timeout: 5000,
      handler: async () => {
        if (cacheManager && typeof cacheManager.reset === 'function') {
          await cacheManager.reset();
        }
      },
    };
  }
}
