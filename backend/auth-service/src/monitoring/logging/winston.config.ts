import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';

export function createWinstonConfig(): WinstonModuleOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const formats = [
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
  ];

  if (isProduction) {
    formats.push(winston.format.json());
  } else {
    formats.push(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, context, correlationId, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        const correlationStr = correlationId ? `[${correlationId}]` : '';
        const contextStr = context ? `[${context}]` : '';
        return `${timestamp} ${level} ${correlationStr}${contextStr} ${message} ${metaStr}`;
      }),
    );
  }

  const transports: winston.transport[] = [
    new winston.transports.Console({
      level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    }),
  ];

  // Add file transports in production
  if (isProduction) {
    transports.push(
      new winston.transports.File({
        filename: 'logs/auth-service-error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: 'logs/auth-service-combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
    );
  }

  return {
    format: winston.format.combine(...formats),
    transports,
    exitOnError: false,
  };
}