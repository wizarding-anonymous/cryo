import { registerAs } from '@nestjs/config';

export default registerAs('logger', () => ({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT || 'json',
  enableConsole: process.env.LOG_CONSOLE !== 'false',
  enableFile: process.env.LOG_FILE === 'true',
  filePath: process.env.LOG_FILE_PATH || './logs/app.log',
  maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
  maxSize: process.env.LOG_MAX_SIZE || '10m',
  enableRequestLogging: process.env.LOG_REQUESTS !== 'false',
  enableErrorLogging: process.env.LOG_ERRORS !== 'false',
  enableMetricsLogging: process.env.LOG_METRICS === 'true',
}));