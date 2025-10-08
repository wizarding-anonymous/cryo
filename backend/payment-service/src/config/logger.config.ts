import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

// Custom format for payment operations
const paymentFormat = winston.format.printf(
  ({ timestamp, level, message, context, correlationId, ...meta }) => {
    const logEntry: any = {
      timestamp,
      level,
      message,
      context,
      correlationId,
      ...meta,
    };

    // Add payment-specific fields if present
    if (meta.paymentId || meta.orderId || meta.userId || meta.provider) {
      logEntry.payment = {
        paymentId: meta.paymentId,
        orderId: meta.orderId,
        userId: meta.userId,
        provider: meta.provider,
        amount: meta.amount,
        currency: meta.currency,
        status: meta.status,
      };
    }

    return JSON.stringify(logEntry);
  },
);

// Environment-based configuration
const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'silly');
const maxSize = process.env.LOG_FILE_MAX_SIZE || '20m';
const maxFiles = process.env.LOG_FILE_MAX_FILES || '14d';
const fileLoggingEnabled = process.env.LOG_FILE_ENABLED !== 'false';

export const winstonLogger: WinstonModuleOptions = {
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
  ),
  defaultMeta: {
    service: 'payment-service',
    version: process.env.npm_package_version || '1.0.0',
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      level: logLevel,
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.printf(
          ({ timestamp, level, message, context, correlationId }) => {
            const contextStr = context ? `[${context}]` : '';
            const correlationStr = correlationId ? `[${correlationId}]` : '';
            return `[${timestamp}] ${level} ${contextStr}${correlationStr}: ${message}`;
          },
        ),
      ),
    }),

    // Application logs (if file logging enabled)
    ...(fileLoggingEnabled
      ? [
          new winston.transports.DailyRotateFile({
            filename: 'logs/application-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize,
            maxFiles,
            level: 'info',
            format: winston.format.combine(
              winston.format.timestamp(),
              paymentFormat,
            ),
          }),

          // Error logs
          new winston.transports.DailyRotateFile({
            filename: 'logs/errors-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize,
            maxFiles,
            level: 'error',
            format: winston.format.combine(
              winston.format.timestamp(),
              paymentFormat,
            ),
          }),

          // Payment-specific logs
          new winston.transports.DailyRotateFile({
            filename: 'logs/payments-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize,
            maxFiles,
            level: 'info',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format((info) => {
                // Only log payment-related entries
                if (
                  info.context &&
                  typeof info.context === 'string' &&
                  (info.context.includes('Payment') ||
                    info.context.includes('Order') ||
                    info.paymentId ||
                    info.orderId)
                ) {
                  return info;
                }
                return false;
              })(),
              paymentFormat,
            ),
          }),

          // Audit logs for critical payment operations
          new winston.transports.DailyRotateFile({
            filename: 'logs/audit-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize,
            maxFiles: '90d', // Keep audit logs longer
            level: 'info',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format((info) => {
                // Only log audit-worthy events
                if (
                  info.audit === true ||
                  (info.context &&
                    typeof info.message === 'string' &&
                    (info.message.includes('created') ||
                      info.message.includes('confirmed') ||
                      info.message.includes('cancelled') ||
                      info.message.includes('failed')))
                ) {
                  return info;
                }
                return false;
              })(),
              paymentFormat,
            ),
          }),
        ]
      : []),
  ],
  exceptionHandlers: fileLoggingEnabled
    ? [
        new winston.transports.DailyRotateFile({
          filename: 'logs/exceptions-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize,
          maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      ]
    : [],
  rejectionHandlers: fileLoggingEnabled
    ? [
        new winston.transports.DailyRotateFile({
          filename: 'logs/rejections-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize,
          maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      ]
    : [],
};
