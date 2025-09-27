import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

export const createLoggerConfig = (
  nodeEnv: string,
  logLevel: string,
  logFormat: string,
): WinstonModuleOptions => {
  const isProduction = nodeEnv === 'production';

  const formats = [
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
  ];

  if (logFormat === 'json') {
    formats.push(winston.format.json());
  } else {
    formats.push(
      winston.format.printf(({ timestamp, level, message, context, stack, ...meta }) => {
        const contextStr = context ? `[${context}] ` : '';
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        const stackStr = stack ? `\n${stack}` : '';
        return `${timestamp} [${level.toUpperCase()}] ${contextStr}${message}${metaStr}${stackStr}`;
      }),
    );
  }

  const transports: winston.transport[] = [];

  // Console transport
  if (!isProduction) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), ...formats),
      }),
    );
  }

  // File transports for production
  if (isProduction) {
    // Error logs with enhanced metadata
    transports.push(
      new winston.transports.DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxFiles: '30d',
        maxSize: '20m',
        format: winston.format.combine(
          winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
          ...formats,
        ),
        auditFile: 'logs/.audit/error-audit.json',
      }),
    );

    // Warning logs
    transports.push(
      new winston.transports.DailyRotateFile({
        filename: 'logs/warn-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'warn',
        maxFiles: '30d',
        maxSize: '20m',
        format: winston.format.combine(...formats),
        auditFile: 'logs/.audit/warn-audit.json',
      }),
    );

    // Info logs (application events)
    transports.push(
      new winston.transports.DailyRotateFile({
        filename: 'logs/app-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'info',
        maxFiles: '30d',
        maxSize: '20m',
        format: winston.format.combine(...formats),
        auditFile: 'logs/.audit/app-audit.json',
      }),
    );

    // Achievement-specific logs
    transports.push(
      new winston.transports.DailyRotateFile({
        filename: 'logs/achievements-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'info',
        maxFiles: '30d',
        maxSize: '20m',
        format: winston.format.combine(
          winston.format.label({ label: 'ACHIEVEMENT' }),
          ...formats,
        ),
        auditFile: 'logs/.audit/achievements-audit.json',
      }),
    );

    // Performance logs
    transports.push(
      new winston.transports.DailyRotateFile({
        filename: 'logs/performance-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'debug',
        maxFiles: '7d', // Shorter retention for performance logs
        maxSize: '50m',
        format: winston.format.combine(
          winston.format.label({ label: 'PERFORMANCE' }),
          ...formats,
        ),
        auditFile: 'logs/.audit/performance-audit.json',
      }),
    );

    // Console for production (structured JSON)
    transports.push(
      new winston.transports.Console({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return JSON.stringify({
              '@timestamp': timestamp,
              level,
              message,
              service: 'achievement-service',
              environment: process.env.NODE_ENV,
              pid: process.pid,
              ...meta,
            });
          }),
        ),
      }),
    );
  }

  return {
    level: logLevel,
    format: winston.format.combine(...formats),
    transports,
    exitOnError: false,
  };
};
