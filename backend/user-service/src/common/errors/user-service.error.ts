import { HttpStatus } from '@nestjs/common';

/**
 * Типизированные коды ошибок для User Service
 */
export const ErrorCodes = {
  // User-related errors
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  INVALID_USER_DATA: 'INVALID_USER_DATA',
  USER_CREATION_FAILED: 'USER_CREATION_FAILED',
  USER_UPDATE_FAILED: 'USER_UPDATE_FAILED',
  USER_DELETION_FAILED: 'USER_DELETION_FAILED',

  // Profile-related errors
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  PROFILE_UPDATE_FAILED: 'PROFILE_UPDATE_FAILED',
  AVATAR_UPLOAD_FAILED: 'AVATAR_UPLOAD_FAILED',
  AVATAR_SIZE_EXCEEDED: 'AVATAR_SIZE_EXCEEDED',
  INVALID_AVATAR_FORMAT: 'INVALID_AVATAR_FORMAT',

  // Cache-related errors
  CACHE_ERROR: 'CACHE_ERROR',
  CACHE_CONNECTION_FAILED: 'CACHE_CONNECTION_FAILED',
  CACHE_OPERATION_FAILED: 'CACHE_OPERATION_FAILED',

  // Database-related errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  DATABASE_CONNECTION_FAILED: 'DATABASE_CONNECTION_FAILED',
  DATABASE_QUERY_FAILED: 'DATABASE_QUERY_FAILED',
  DATABASE_CONSTRAINT_VIOLATION: 'DATABASE_CONSTRAINT_VIOLATION',

  // External service errors
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  AUTH_SERVICE_UNAVAILABLE: 'AUTH_SERVICE_UNAVAILABLE',
  GAME_CATALOG_SERVICE_UNAVAILABLE: 'GAME_CATALOG_SERVICE_UNAVAILABLE',
  PAYMENT_SERVICE_UNAVAILABLE: 'PAYMENT_SERVICE_UNAVAILABLE',

  // Batch operation errors
  BATCH_OPERATION_FAILED: 'BATCH_OPERATION_FAILED',
  BATCH_SIZE_EXCEEDED: 'BATCH_SIZE_EXCEEDED',
  BATCH_VALIDATION_FAILED: 'BATCH_VALIDATION_FAILED',

  // Rate limiting and security
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  FORBIDDEN_OPERATION: 'FORBIDDEN_OPERATION',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT_FORMAT: 'INVALID_INPUT_FORMAT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Generic errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Маппинг кодов ошибок на HTTP статусы
 */
export const ErrorCodeToHttpStatus: Record<ErrorCode, HttpStatus> = {
  // 404 Not Found
  [ErrorCodes.USER_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCodes.PROFILE_NOT_FOUND]: HttpStatus.NOT_FOUND,

  // 409 Conflict
  [ErrorCodes.USER_ALREADY_EXISTS]: HttpStatus.CONFLICT,
  [ErrorCodes.DATABASE_CONSTRAINT_VIOLATION]: HttpStatus.CONFLICT,

  // 400 Bad Request
  [ErrorCodes.INVALID_USER_DATA]: HttpStatus.BAD_REQUEST,
  [ErrorCodes.AVATAR_SIZE_EXCEEDED]: HttpStatus.BAD_REQUEST,
  [ErrorCodes.INVALID_AVATAR_FORMAT]: HttpStatus.BAD_REQUEST,
  [ErrorCodes.BATCH_SIZE_EXCEEDED]: HttpStatus.BAD_REQUEST,
  [ErrorCodes.BATCH_VALIDATION_FAILED]: HttpStatus.BAD_REQUEST,
  [ErrorCodes.VALIDATION_ERROR]: HttpStatus.BAD_REQUEST,
  [ErrorCodes.INVALID_INPUT_FORMAT]: HttpStatus.BAD_REQUEST,
  [ErrorCodes.MISSING_REQUIRED_FIELD]: HttpStatus.BAD_REQUEST,

  // 401 Unauthorized
  [ErrorCodes.UNAUTHORIZED_ACCESS]: HttpStatus.UNAUTHORIZED,
  [ErrorCodes.INVALID_CREDENTIALS]: HttpStatus.UNAUTHORIZED,

  // 403 Forbidden
  [ErrorCodes.FORBIDDEN_OPERATION]: HttpStatus.FORBIDDEN,

  // 429 Too Many Requests
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: HttpStatus.TOO_MANY_REQUESTS,

  // 422 Unprocessable Entity
  [ErrorCodes.USER_CREATION_FAILED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCodes.USER_UPDATE_FAILED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCodes.USER_DELETION_FAILED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCodes.PROFILE_UPDATE_FAILED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCodes.AVATAR_UPLOAD_FAILED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCodes.BATCH_OPERATION_FAILED]: HttpStatus.UNPROCESSABLE_ENTITY,

  // 503 Service Unavailable
  [ErrorCodes.SERVICE_UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  [ErrorCodes.AUTH_SERVICE_UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  [ErrorCodes.GAME_CATALOG_SERVICE_UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  [ErrorCodes.PAYMENT_SERVICE_UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  [ErrorCodes.DATABASE_CONNECTION_FAILED]: HttpStatus.SERVICE_UNAVAILABLE,
  [ErrorCodes.CACHE_CONNECTION_FAILED]: HttpStatus.SERVICE_UNAVAILABLE,

  // 500 Internal Server Error
  [ErrorCodes.INTERNAL_SERVER_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCodes.DATABASE_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCodes.DATABASE_QUERY_FAILED]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCodes.CACHE_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCodes.CACHE_OPERATION_FAILED]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCodes.EXTERNAL_SERVICE_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCodes.TIMEOUT_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCodes.CONFIGURATION_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
};

/**
 * Детали ошибки для более подробной информации
 */
export interface ErrorDetails {
  field?: string;
  value?: any;
  constraint?: string;
  context?: Record<string, any>;
  retryable?: boolean;
  retryAfter?: number;
}

/**
 * Стандартизированная ошибка User Service
 */
export class UserServiceError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: HttpStatus;
  public readonly details?: ErrorDetails;
  public readonly correlationId?: string;
  public readonly timestamp: Date;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    details?: ErrorDetails,
    correlationId?: string,
    cause?: Error,
  ) {
    super(message);

    this.name = 'UserServiceError';
    this.code = code;
    this.statusCode = ErrorCodeToHttpStatus[code];
    this.details = details;
    this.correlationId = correlationId;
    this.timestamp = new Date();
    this.isOperational = true;

    // Сохраняем оригинальную ошибку как причину
    if (cause) {
      (this as any).cause = cause;
      this.stack = cause.stack;
    }

    // Обеспечиваем правильный прототип для instanceof проверок
    Object.setPrototypeOf(this, UserServiceError.prototype);
  }

  /**
   * Создает ошибку "Пользователь не найден"
   */
  static userNotFound(
    userId: string,
    correlationId?: string,
  ): UserServiceError {
    return new UserServiceError(
      ErrorCodes.USER_NOT_FOUND,
      `Пользователь с ID ${userId} не найден`,
      { field: 'id', value: userId },
      correlationId,
    );
  }

  /**
   * Создает ошибку "Пользователь уже существует"
   */
  static userAlreadyExists(
    email: string,
    correlationId?: string,
  ): UserServiceError {
    return new UserServiceError(
      ErrorCodes.USER_ALREADY_EXISTS,
      `Пользователь с email ${email} уже существует`,
      { field: 'email', value: email },
      correlationId,
    );
  }

  /**
   * Создает ошибку валидации
   */
  static validationError(
    message: string,
    field?: string,
    value?: any,
    correlationId?: string,
  ): UserServiceError {
    return new UserServiceError(
      ErrorCodes.VALIDATION_ERROR,
      message,
      { field, value },
      correlationId,
    );
  }

  /**
   * Создает ошибку базы данных
   */
  static databaseError(
    message: string,
    cause?: Error,
    correlationId?: string,
  ): UserServiceError {
    return new UserServiceError(
      ErrorCodes.DATABASE_ERROR,
      message,
      { retryable: true },
      correlationId,
      cause,
    );
  }

  /**
   * Создает ошибку кэша
   */
  static cacheError(
    message: string,
    cause?: Error,
    correlationId?: string,
  ): UserServiceError {
    return new UserServiceError(
      ErrorCodes.CACHE_ERROR,
      message,
      { retryable: true },
      correlationId,
      cause,
    );
  }

  /**
   * Создает ошибку внешнего сервиса
   */
  static externalServiceError(
    serviceName: string,
    message: string,
    retryAfter?: number,
    correlationId?: string,
    cause?: Error,
  ): UserServiceError {
    return new UserServiceError(
      ErrorCodes.EXTERNAL_SERVICE_ERROR,
      `Ошибка внешнего сервиса ${serviceName}: ${message}`,
      {
        context: { serviceName },
        retryable: true,
        retryAfter,
      },
      correlationId,
      cause,
    );
  }

  /**
   * Создает ошибку превышения лимита запросов
   */
  static rateLimitExceeded(
    retryAfter: number,
    correlationId?: string,
  ): UserServiceError {
    return new UserServiceError(
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      'Превышен лимит запросов',
      { retryable: true, retryAfter },
      correlationId,
    );
  }

  /**
   * Создает ошибку batch операции
   */
  static batchOperationFailed(
    operation: string,
    failedCount: number,
    totalCount: number,
    correlationId?: string,
  ): UserServiceError {
    return new UserServiceError(
      ErrorCodes.BATCH_OPERATION_FAILED,
      `Batch операция ${operation} завершилась с ошибками: ${failedCount}/${totalCount}`,
      {
        context: { operation, failedCount, totalCount },
        retryable: true,
      },
      correlationId,
    );
  }

  /**
   * Преобразует в JSON для API ответа
   */
  toJSON(): Record<string, any> {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      correlationId: this.correlationId,
      details: this.details,
    };
  }

  /**
   * Проверяет, является ли ошибка операционной (ожидаемой)
   */
  static isOperationalError(error: Error): boolean {
    return error instanceof UserServiceError && error.isOperational;
  }

  /**
   * Проверяет, можно ли повторить операцию
   */
  isRetryable(): boolean {
    return this.details?.retryable === true;
  }

  /**
   * Получает время ожидания перед повтором (в секундах)
   */
  getRetryAfter(): number | undefined {
    return this.details?.retryAfter;
  }
}
