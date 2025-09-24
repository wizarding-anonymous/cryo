import { utilities as nestWinstonModuleUtilities, WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';

// Enhanced structured logging format for production
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service, correlationId, userId, ip, ...meta }) => {
    return JSON.stringify({
      '@timestamp': timestamp,
      level,
      message,
      service: service || 'security-service',
      correlationId,
      userId,
      ip,
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      ...meta,
    });
  })
);

const developmentFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.ms(),
  winston.format.errors({ stack: true }),
  nestWinstonModuleUtilities.format.nestLike('security-service', {
    colors: true,
    prettyPrint: true,
  }),
);

export const winstonLogger: WinstonModuleOptions = {
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  defaultMeta: {
    service: 'security-service',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  },
  transports: [
    new winston.transports.Console({
      format: isProduction ? productionFormat : developmentFormat,
    }),
    // File transport for production logs
    ...(isProduction ? [
      new winston.transports.File({
        filename: 'logs/security-service-error.log',
        level: 'error',
        format: productionFormat,
        maxsize: 50 * 1024 * 1024, // 50MB
        maxFiles: 10,
      }),
      new winston.transports.File({
        filename: 'logs/security-service-combined.log',
        format: productionFormat,
        maxsize: 100 * 1024 * 1024, // 100MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: 'logs/security-events.log',
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
          winston.format.printf((info) => {
            const { timestamp, level, message, eventType, userId, ip, riskScore, ...meta } = info;
            // Only log security-related events to this file
            if (eventType || (typeof message === 'string' && (message.includes('security') || message.includes('alert') || message.includes('block')))) {
              return JSON.stringify({
                '@timestamp': timestamp,
                level,
                message,
                eventType,
                userId,
                ip,
                riskScore,
                service: 'security-service',
                ...meta,
              });
            }
            return '';
          }),
          winston.format((info) => {
            // Filter out empty messages
            return info.message ? info : false;
          })()
        ),
        maxsize: 100 * 1024 * 1024, // 100MB
        maxFiles: 20, // Keep more security event logs
      })
    ] : []),
  ],
  // Handle uncaught exceptions and rejections
  exceptionHandlers: isProduction ? [
    new winston.transports.File({
      filename: 'logs/exceptions.log',
      format: productionFormat,
    })
  ] : [],
  rejectionHandlers: isProduction ? [
    new winston.transports.File({
      filename: 'logs/rejections.log',
      format: productionFormat,
    })
  ] : [],
};
