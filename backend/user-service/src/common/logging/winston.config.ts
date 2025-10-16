import { transports, format, LoggerOptions } from 'winston';

export interface WinstonConfigOptions {
  level: string;
  format: 'json' | 'simple';
  nodeEnv: string;
  serviceName: string;
  serviceVersion: string;
}

export function createWinstonConfig(
  options: WinstonConfigOptions,
): LoggerOptions {
  const {
    level,
    format: logFormat,
    nodeEnv,
    serviceName,
    serviceVersion,
  } = options;

  // ELK Stack compatible format
  const elkFormat = format.combine(
    format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }), // ISO 8601 format for ELK
    format.errors({ stack: true }),
    format.json(),
    format.printf((info) => {
      // Ensure consistent structure for ELK Stack
      const logEntry = {
        '@timestamp': info.timestamp,
        level: info.level,
        message: info.message,
        service: serviceName,
        version: serviceVersion,
        environment: nodeEnv,
        correlationId: info.correlationId,
        userId: info.userId,
        operation: info.operation,
        duration: info.duration,
        ipAddress: info.ipAddress,
        userAgent: info.userAgent,
        requestId: info.requestId,
        metadata: info.metadata,
        stack: info.stack,
        // Add ELK-specific fields
        host: process.env.HOSTNAME || 'unknown',
        pid: process.pid,
        container: process.env.CONTAINER_NAME || serviceName,
      };

      // Remove undefined fields to keep logs clean
      Object.keys(logEntry).forEach((key) => {
        if (logEntry[key] === undefined) {
          delete logEntry[key];
        }
      });

      return JSON.stringify(logEntry);
    }),
  );

  // Development format (human-readable)
  const developmentFormat = format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    format.errors({ stack: true }),
    format.colorize({ all: true }),
    format.printf((info) => {
      const correlationId = info.correlationId
        ? `[${info.correlationId}] `
        : '';
      const userId = info.userId ? `[User:${info.userId}] ` : '';
      const duration = info.duration ? ` (${info.duration}ms)` : '';
      const metadata =
        info.metadata && Object.keys(info.metadata).length > 0
          ? `\n${JSON.stringify(info.metadata, null, 2)}`
          : '';

      return `[${info.timestamp}] [${serviceName}] ${correlationId}${userId}${info.level}: ${info.message}${duration}${metadata}`;
    }),
  );

  // Test format (minimal)
  const testFormat = format.combine(
    format.timestamp({ format: 'HH:mm:ss' }),
    format.printf(
      (info) => `[${info.timestamp}] ${info.level}: ${info.message}`,
    ),
  );

  // Choose format based on environment and configuration
  let selectedFormat;
  if (nodeEnv === 'test') {
    selectedFormat = testFormat;
  } else if (nodeEnv === 'production' || logFormat === 'json') {
    selectedFormat = elkFormat;
  } else {
    selectedFormat = developmentFormat;
  }

  // Configure transports based on environment
  const logTransports: any[] = [];

  // Console transport (always present)
  logTransports.push(
    new transports.Console({
      level,
      format: selectedFormat,
      silent: nodeEnv === 'test' && process.env.SILENT_LOGS === 'true',
    }),
  );

  // HTTP transport for Logstash (ELK Stack integration)
  if (nodeEnv === 'production' || process.env.ENABLE_ELK_LOGGING === 'true') {
    const logstashHost = process.env.LOGSTASH_HOST || 'logstash';
    const logstashPort = parseInt(process.env.LOGSTASH_HTTP_PORT || '8080');

    logTransports.push(
      new transports.Http({
        host: logstashHost,
        port: logstashPort,
        path: '/logs',
        format: elkFormat,
        level: 'info',
        // Add retry logic for ELK connectivity issues
        handleExceptions: false,
        handleRejections: false,
      }),
    );
  }

  // File transports for production and development
  if (nodeEnv === 'production') {
    // Structured logs for ELK Stack
    logTransports.push(
      new transports.File({
        filename: 'logs/structured.log',
        format: elkFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 10,
        tailable: true,
      }),
    );

    // Error log file
    logTransports.push(
      new transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: elkFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true,
      }),
    );

    // Audit log file (separate for compliance)
    logTransports.push(
      new transports.File({
        filename: 'logs/audit.log',
        format: elkFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 20,
        tailable: true,
        // Only log audit events
        level: 'info',
      }),
    );
  } else if (nodeEnv === 'development') {
    // Development file logging (structured for ELK testing)
    logTransports.push(
      new transports.File({
        filename: 'logs/dev.log',
        level: 'debug',
        format: elkFormat,
        maxsize: 2097152, // 2MB
        maxFiles: 3,
        tailable: true,
      }),
    );
  }

  return {
    level,
    format: selectedFormat,
    transports: logTransports,
    defaultMeta: {
      service: serviceName,
      version: serviceVersion,
      environment: nodeEnv,
      host: process.env.HOSTNAME || 'unknown',
      pid: process.pid,
    },
    exitOnError: false,
    handleExceptions: true,
    handleRejections: true,
  };
}
