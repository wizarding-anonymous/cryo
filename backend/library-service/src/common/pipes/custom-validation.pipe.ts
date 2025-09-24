import {
  ValidationPipe,
  BadRequestException,
  ValidationError,
  ArgumentMetadata,
} from '@nestjs/common';
import { Logger } from '@nestjs/common';

/**
 * Enhanced Custom Validation Pipe
 * Features:
 * - Detailed error messages
 * - Request context logging
 * - Custom error formatting
 * - Sanitization options
 */
export class CustomValidationPipe extends ValidationPipe {
  private readonly logger = new Logger(CustomValidationPipe.name);

  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors: ValidationError[]) => {
        return new BadRequestException({
          message: 'Validation failed',
          errors: this.formatErrors(errors),
          timestamp: new Date().toISOString(),
        });
      },
    });
  }

  async transform(value: any, metadata: ArgumentMetadata) {
    // Log validation attempts for debugging
    if (metadata.type === 'body' && value) {
      this.logger.debug(
        `Validating ${metadata.metatype?.name || 'unknown'} body`,
      );
    }

    try {
      const result = await super.transform(value, metadata);

      // Sanitize the result
      return this.sanitizeValue(result);
    } catch (error) {
      this.logger.warn(
        `Validation failed for ${metadata.metatype?.name}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * Format validation errors into a more readable structure
   */
  private formatErrors(errors: ValidationError[]): any[] {
    return errors.map((error) => ({
      field: error.property,
      value: error.value,
      constraints: error.constraints,
      children: error.children?.length
        ? this.formatErrors(error.children)
        : undefined,
    }));
  }

  /**
   * Sanitize values to prevent XSS and other security issues
   */
  private sanitizeValue(value: any): any {
    if (typeof value === 'string') {
      // Basic XSS prevention - remove script tags and javascript: protocols
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .trim();
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item));
    }

    if (value && typeof value === 'object') {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = this.sanitizeValue(val);
      }
      return sanitized;
    }

    return value;
  }
}
