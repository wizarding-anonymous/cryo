import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

export function createProductionLogger() {
  const isProduction = process.env.NODE_ENV === 'production';
  const logLevel = process.env.LOG_LEVEL || (isProduction ? 'warn' : 'info');

  const formats = [
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
  ];

  if (isProduction) {
    // Production: JSON format for log aggregation
    formats.push(
      winston.format.json(),
      winston.format.printf(
        ({ timestamp, level, message, context, trace, ...meta }) => {
          const logEntry: Record<string, any> = {
            timestamp,
            level,
            message,
            service: 'api-gateway',
            context,
            ...meta,
          };
          if (trace) {
            logEntry.trace = trace;
          }
          return JSON.stringify(logEntry);
        },
      ),
    );
  } else {
    // Development: Human-readable format
    formats.push(
      winston.format.colorize({ all: true }),
      winston.format.printf(({ timestamp, level, message, context, trace }) => {
        const contextStr = context ? `[${context}] ` : '';
        const traceStr = trace ? `\n${trace}` : '';
        return `${timestamp} ${level}: ${contextStr}${message}${traceStr}`;
      }),
    );
  }

  const transports: winston.transport[] = [
    new winston.transports.Console({
      level: logLevel,
      handleExceptions: true,
      handleRejections: true,
    }),
  ];

  // Add file transport for production
  if (isProduction) {
    transports.push(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        tailable: true,
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        level: logLevel,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        tailable: true,
      }),
    );
  }

  return WinstonModule.createLogger({
    level: logLevel,
    format: winston.format.combine(...formats),
    transports,
    exitOnError: false,
  });
}

export const productionLoggerConfig = {
  provide: 'WINSTON_MODULE_OPTIONS',
  useFactory: () => createProductionLogger(),
};
