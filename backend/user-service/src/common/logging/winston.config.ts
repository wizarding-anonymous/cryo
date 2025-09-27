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

  // Base format with metadata
  const baseFormat = format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    format.errors({ stack: true }),
    format.metadata({
      fillExcept: ['message', 'level', 'timestamp', 'label'],
    }),
  );

  // Development format (human-readable)
  const developmentFormat = format.combine(
    baseFormat,
    format.colorize({ all: true }),
    format.printf((info) => {
      const { timestamp, level, message, metadata } = info;
      const metaObj = metadata && typeof metadata === 'object' ? metadata : {};
      const metaStr =
        Object.keys(metaObj).length > 0
          ? `\n${JSON.stringify(metaObj, null, 2)}`
          : '';
      return `[${timestamp}] [${serviceName}] ${level}: ${message}${metaStr}`;
    }),
  );

  // Production format (structured JSON)
  const productionFormat = format.combine(
    baseFormat,
    format.json(),
    format.printf((info) => {
      const metadata =
        info.metadata && typeof info.metadata === 'object' ? info.metadata : {};
      return JSON.stringify({
        timestamp: info.timestamp,
        level: info.level,
        message: info.message,
        service: serviceName,
        version: serviceVersion,
        environment: nodeEnv,
        ...metadata,
      });
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
    selectedFormat = productionFormat;
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

  // File transports for production and development
  if (nodeEnv === 'production') {
    // Error log file
    logTransports.push(
      new transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: format.combine(
          format.timestamp(),
          format.errors({ stack: true }),
          format.json(),
        ),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
    );

    // Combined log file
    logTransports.push(
      new transports.File({
        filename: 'logs/combined.log',
        format: format.combine(
          format.timestamp(),
          format.errors({ stack: true }),
          format.json(),
        ),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
    );

    // Application log file
    logTransports.push(
      new transports.File({
        filename: 'logs/app.log',
        level: 'info',
        format: format.combine(
          format.timestamp(),
          format.errors({ stack: true }),
          format.json(),
        ),
        maxsize: 5242880, // 5MB
        maxFiles: 10,
      }),
    );
  } else if (nodeEnv === 'development') {
    // Development file logging (optional)
    logTransports.push(
      new transports.File({
        filename: 'logs/dev.log',
        level: 'debug',
        format: format.combine(
          format.timestamp(),
          format.errors({ stack: true }),
          format.json(),
        ),
        maxsize: 1048576, // 1MB
        maxFiles: 3,
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
    },
    exitOnError: false,
    handleExceptions: true,
    handleRejections: true,
  };
}
