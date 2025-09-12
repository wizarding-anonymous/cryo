import { transports, format } from 'winston';
import { WinstonModule } from 'nest-winston';

export const winstonConfig = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6,
  },
  transports: [
    new transports.Console({
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.colorize({ all: true }),
        format.printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`),
      ),
    }),
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: format.combine(format.timestamp(), format.json()),
    }),
    new transports.File({
      filename: 'logs/combined.log',
      format: format.combine(format.timestamp(), format.json()),
    }),
  ],
};

export const logger = WinstonModule.createLogger(winstonConfig);
