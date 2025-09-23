import { Injectable, LoggerService, ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CustomLoggerService extends ConsoleLogger implements LoggerService {
  private readonly logLevel: string;
  private readonly enableFile: boolean;
  private readonly filePath: string;
  private readonly enableRequestLogging: boolean;
  private readonly enableErrorLogging: boolean;
  private readonly enableMetricsLogging: boolean;

  constructor(private readonly configService: ConfigService) {
    super();
    this.logLevel = this.configService.get<string>('logger.level', 'info');
    this.enableFile = this.configService.get<boolean>('logger.enableFile', false);
    this.filePath = this.configService.get<string>('logger.filePath', './logs/app.log');
    this.enableRequestLogging = this.configService.get<boolean>('logger.enableRequestLogging', true);
    this.enableErrorLogging = this.configService.get<boolean>('logger.enableErrorLogging', true);
    this.enableMetricsLogging = this.configService.get<boolean>('logger.enableMetricsLogging', false);

    // Create logs directory if file logging is enabled
    if (this.enableFile) {
      const logDir = path.dirname(this.filePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['error', 'warn', 'log', 'debug', 'verbose'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  private formatLogMessage(level: string, message: any, context?: string, trace?: string): string {
    const timestamp = new Date().toISOString();
    const pid = process.pid;
    const contextStr = context ? `[${context}]` : '';
    
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      pid,
      context: context || 'Application',
      message: typeof message === 'object' ? JSON.stringify(message) : message,
      ...(trace && { trace }),
    };

    return JSON.stringify(logEntry);
  }

  private writeToFile(formattedMessage: string): void {
    if (this.enableFile) {
      try {
        fs.appendFileSync(this.filePath, formattedMessage + '\n');
      } catch (error) {
        // Fallback to console if file writing fails
        console.error('Failed to write to log file:', error);
      }
    }
  }

  log(message: any, context?: string): void {
    if (!this.shouldLog('log')) return;
    
    const formattedMessage = this.formatLogMessage('log', message, context);
    console.log(formattedMessage);
    this.writeToFile(formattedMessage);
  }

  error(message: any, trace?: string, context?: string): void {
    if (!this.enableErrorLogging || !this.shouldLog('error')) return;
    
    const formattedMessage = this.formatLogMessage('error', message, context, trace);
    console.error(formattedMessage);
    this.writeToFile(formattedMessage);
  }

  warn(message: any, context?: string): void {
    if (!this.shouldLog('warn')) return;
    
    const formattedMessage = this.formatLogMessage('warn', message, context);
    console.warn(formattedMessage);
    this.writeToFile(formattedMessage);
  }

  debug(message: any, context?: string): void {
    if (!this.shouldLog('debug')) return;
    
    const formattedMessage = this.formatLogMessage('debug', message, context);
    console.debug(formattedMessage);
    this.writeToFile(formattedMessage);
  }

  verbose(message: any, context?: string): void {
    if (!this.shouldLog('verbose')) return;
    
    const formattedMessage = this.formatLogMessage('verbose', message, context);
    console.log(formattedMessage);
    this.writeToFile(formattedMessage);
  }

  // Custom methods for specific logging needs
  logRequest(method: string, url: string, statusCode: number, responseTime: number, userAgent?: string): void {
    if (!this.enableRequestLogging) return;

    const requestLog = {
      type: 'request',
      method,
      url,
      statusCode,
      responseTime: `${responseTime}ms`,
      userAgent,
    };

    this.log(requestLog, 'HTTP');
  }

  logMetrics(metricName: string, value: number, labels?: Record<string, string>): void {
    if (!this.enableMetricsLogging) return;

    const metricsLog = {
      type: 'metrics',
      metric: metricName,
      value,
      labels,
    };

    this.log(metricsLog, 'METRICS');
  }

  logDatabaseQuery(query: string, duration: number, error?: Error): void {
    const dbLog = {
      type: 'database',
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      duration: `${duration}ms`,
      ...(error && { error: error.message }),
    };

    if (error) {
      this.error(dbLog, error.stack, 'DATABASE');
    } else {
      this.debug(dbLog, 'DATABASE');
    }
  }

  logExternalService(serviceName: string, method: string, url: string, statusCode?: number, duration?: number, error?: Error): void {
    const serviceLog = {
      type: 'external_service',
      service: serviceName,
      method,
      url,
      ...(statusCode && { statusCode }),
      ...(duration && { duration: `${duration}ms` }),
      ...(error && { error: error.message }),
    };

    if (error) {
      this.error(serviceLog, error.stack, 'EXTERNAL');
    } else {
      this.log(serviceLog, 'EXTERNAL');
    }
  }
}