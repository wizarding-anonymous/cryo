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
    // Error logs
    transports.push(
      new winston.transports.DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxFiles: '30d',
        maxSize: '20m',
        format: winston.format.combine(...formats),
      }),
    );

    // Combined logs
    transports.push(
      new winston.transports.DailyRotateFile({
        filename: 'logs/combined-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: '30d',
        maxSize: '20m',
        format: winston.format.combine(...formats),
      }),
    );

    // Console for production (structured)
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(...formats),
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
