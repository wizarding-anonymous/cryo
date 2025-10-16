import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SecureLoggerService extends Logger {
  private readonly sensitiveFields = [
    'password',
    'secret',
    'key',
    'currentPassword',
    'newPassword',
  ];

  /**
   * Sanitizes an object by removing or masking sensitive fields
   * @param data - The data to sanitize
   * @returns Sanitized data safe for logging
   */
  private sanitizeForLogging(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeForLogging(item));
    }

    const sanitized = { ...data };

    for (const field of this.sensitiveFields) {
      if (sanitized[field] !== undefined) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeForLogging(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Logs data safely by sanitizing sensitive information
   * @param message - Log message
   * @param data - Data to log (will be sanitized)
   * @param context - Optional context
   */
  logSafe(message: string, data?: any, context?: string): void {
    const sanitizedData = data ? this.sanitizeForLogging(data) : undefined;
    if (sanitizedData) {
      super.log(`${message}: ${JSON.stringify(sanitizedData)}`, context);
    } else {
      super.log(message, context);
    }
  }

  /**
   * Logs debug information safely
   * @param message - Debug message
   * @param data - Data to log (will be sanitized)
   * @param context - Optional context
   */
  debugSafe(message: string, data?: any, context?: string): void {
    const sanitizedData = data ? this.sanitizeForLogging(data) : undefined;
    if (sanitizedData) {
      super.debug(`${message}: ${JSON.stringify(sanitizedData)}`, context);
    } else {
      super.debug(message, context);
    }
  }

  /**
   * Logs error information safely
   * @param message - Error message
   * @param error - Error object or data
   * @param context - Optional context
   */
  errorSafe(message: string, error?: any, context?: string): void {
    const sanitizedError = error ? this.sanitizeForLogging(error) : undefined;
    if (sanitizedError) {
      super.error(`${message}: ${JSON.stringify(sanitizedError)}`, context);
    } else {
      super.error(message, context);
    }
  }
}
