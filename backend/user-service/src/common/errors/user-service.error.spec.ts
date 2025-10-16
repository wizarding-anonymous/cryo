import { HttpStatus } from '@nestjs/common';
import {
  UserServiceError,
  ErrorCodes,
  ErrorCodeToHttpStatus,
} from './user-service.error';

describe('UserServiceError', () => {
  describe('constructor', () => {
    it('should create error with all properties', () => {
      const correlationId = 'test-correlation-id';
      const details = { field: 'email', value: 'test@example.com' };
      const error = new UserServiceError(
        ErrorCodes.USER_NOT_FOUND,
        'User not found',
        details,
        correlationId,
      );

      expect(error.code).toBe(ErrorCodes.USER_NOT_FOUND);
      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(HttpStatus.NOT_FOUND);
      expect(error.details).toBe(details);
      expect(error.correlationId).toBe(correlationId);
      expect(error.isOperational).toBe(true);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should set correct HTTP status code from mapping', () => {
      const error = new UserServiceError(
        ErrorCodes.USER_ALREADY_EXISTS,
        'User already exists',
      );

      expect(error.statusCode).toBe(HttpStatus.CONFLICT);
    });

    it('should preserve original error stack when cause is provided', () => {
      const originalError = new Error('Original error');
      const error = new UserServiceError(
        ErrorCodes.DATABASE_ERROR,
        'Database error',
        undefined,
        undefined,
        originalError,
      );

      expect(error.stack).toBe(originalError.stack);
    });
  });

  describe('static factory methods', () => {
    it('should create userNotFound error', () => {
      const userId = 'test-user-id';
      const correlationId = 'test-correlation-id';
      const error = UserServiceError.userNotFound(userId, correlationId);

      expect(error.code).toBe(ErrorCodes.USER_NOT_FOUND);
      expect(error.message).toBe(`Пользователь с ID ${userId} не найден`);
      expect(error.statusCode).toBe(HttpStatus.NOT_FOUND);
      expect(error.correlationId).toBe(correlationId);
      expect(error.details?.field).toBe('id');
      expect(error.details?.value).toBe(userId);
    });

    it('should create userAlreadyExists error', () => {
      const email = 'test@example.com';
      const correlationId = 'test-correlation-id';
      const error = UserServiceError.userAlreadyExists(email, correlationId);

      expect(error.code).toBe(ErrorCodes.USER_ALREADY_EXISTS);
      expect(error.message).toBe(
        `Пользователь с email ${email} уже существует`,
      );
      expect(error.statusCode).toBe(HttpStatus.CONFLICT);
      expect(error.correlationId).toBe(correlationId);
      expect(error.details?.field).toBe('email');
      expect(error.details?.value).toBe(email);
    });

    it('should create validationError', () => {
      const message = 'Invalid input';
      const field = 'name';
      const value = '';
      const correlationId = 'test-correlation-id';
      const error = UserServiceError.validationError(
        message,
        field,
        value,
        correlationId,
      );

      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(error.correlationId).toBe(correlationId);
      expect(error.details?.field).toBe(field);
      expect(error.details?.value).toBe(value);
    });

    it('should create databaseError with retryable flag', () => {
      const message = 'Connection failed';
      const correlationId = 'test-correlation-id';
      const error = UserServiceError.databaseError(
        message,
        undefined,
        correlationId,
      );

      expect(error.code).toBe(ErrorCodes.DATABASE_ERROR);
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(error.correlationId).toBe(correlationId);
      expect(error.details?.retryable).toBe(true);
      expect(error.isRetryable()).toBe(true);
    });

    it('should create rateLimitExceeded with retry after', () => {
      const retryAfter = 60;
      const correlationId = 'test-correlation-id';
      const error = UserServiceError.rateLimitExceeded(
        retryAfter,
        correlationId,
      );

      expect(error.code).toBe(ErrorCodes.RATE_LIMIT_EXCEEDED);
      expect(error.statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(error.correlationId).toBe(correlationId);
      expect(error.details?.retryAfter).toBe(retryAfter);
      expect(error.getRetryAfter()).toBe(retryAfter);
    });
  });

  describe('utility methods', () => {
    it('should identify operational errors', () => {
      const operationalError = new UserServiceError(
        ErrorCodes.USER_NOT_FOUND,
        'User not found',
      );
      const regularError = new Error('Regular error');

      expect(UserServiceError.isOperationalError(operationalError)).toBe(true);
      expect(UserServiceError.isOperationalError(regularError)).toBe(false);
    });

    it('should convert to JSON correctly', () => {
      const correlationId = 'test-correlation-id';
      const details = { field: 'email' };
      const error = new UserServiceError(
        ErrorCodes.USER_NOT_FOUND,
        'User not found',
        details,
        correlationId,
      );

      const json = error.toJSON();

      expect(json).toEqual({
        code: ErrorCodes.USER_NOT_FOUND,
        message: 'User not found',
        statusCode: HttpStatus.NOT_FOUND,
        timestamp: error.timestamp.toISOString(),
        correlationId,
        details,
      });
    });

    it('should check retryable status', () => {
      const retryableError = UserServiceError.databaseError('DB error');
      const nonRetryableError = UserServiceError.userNotFound('user-id');

      expect(retryableError.isRetryable()).toBe(true);
      expect(nonRetryableError.isRetryable()).toBe(false);
    });
  });

  describe('ErrorCodeToHttpStatus mapping', () => {
    it('should have correct mappings for all error codes', () => {
      // Test a few key mappings
      expect(ErrorCodeToHttpStatus[ErrorCodes.USER_NOT_FOUND]).toBe(
        HttpStatus.NOT_FOUND,
      );
      expect(ErrorCodeToHttpStatus[ErrorCodes.USER_ALREADY_EXISTS]).toBe(
        HttpStatus.CONFLICT,
      );
      expect(ErrorCodeToHttpStatus[ErrorCodes.VALIDATION_ERROR]).toBe(
        HttpStatus.BAD_REQUEST,
      );
      expect(ErrorCodeToHttpStatus[ErrorCodes.RATE_LIMIT_EXCEEDED]).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
      expect(ErrorCodeToHttpStatus[ErrorCodes.INTERNAL_SERVER_ERROR]).toBe(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    it('should have mappings for all error codes', () => {
      // Ensure every error code has a corresponding HTTP status
      Object.values(ErrorCodes).forEach((code) => {
        expect(ErrorCodeToHttpStatus[code]).toBeDefined();
        expect(typeof ErrorCodeToHttpStatus[code]).toBe('number');
      });
    });
  });
});
