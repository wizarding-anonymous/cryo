import { transports, format } from 'winston';

export const winstonConfig = {
  transports: [
    new transports.Console({
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.colorize({ all: true }),
        format.printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`),
      ),
    }),
    // In production, you might want to log to a file or a logging service
    // new transports.File({
    //   filename: 'logs/error.log',
    //   level: 'error',
    //   format: format.combine(format.timestamp(), format.json()),
    // }),
    // new transports.File({
    //   filename: 'logs/combined.log',
    //   format: format.combine(format.timestamp(), format.json()),
    // }),
  ],
};
