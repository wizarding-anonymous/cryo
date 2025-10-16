import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request, Response } from 'express';
import { LoggingService } from '../logging/logging.service';
import { UserServiceError, ErrorCodes } from '../errors';
import { ApiResponseDto } from '../dto/api-response.dto';

/**
 * Стандартизированный формат ответа об ошибке
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    correlationId: string;
    timestamp: string;
    path: string;
    details?: Record<string, any>;
  };
}

/**
 * Простой формат ответа для тестовой среды
 */
interface SimpleErrorResponse {
  message: string | string[];
}

// Маппинг HTTP статусов на коды ошибок для обратной совместимости
const getErrorCodeFromStatus = (status: HttpStatus): string => {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return ErrorCodes.VALIDATION_ERROR;
    case HttpStatus.UNAUTHORIZED:
      return ErrorCodes.UNAUTHORIZED_ACCESS;
    case HttpStatus.FORBIDDEN:
      return ErrorCodes.FORBIDDEN_OPERATION;
    case HttpStatus.NOT_FOUND:
      return ErrorCodes.USER_NOT_FOUND;
    case HttpStatus.CONFLICT:
      return ErrorCodes.USER_ALREADY_EXISTS;
    case HttpStatus.TOO_MANY_REQUESTS:
      return ErrorCodes.RATE_LIMIT_EXCEEDED;
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return ErrorCodes.VALIDATION_ERROR;
    case HttpStatus.SERVICE_UNAVAILABLE:
      return ErrorCodes.SERVICE_UNAVAILABLE;
    default:
      return ErrorCodes.INTERNAL_SERVER_ERROR;
  }
};

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly loggingService: LoggingService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Извлекаем correlation ID и контекст из запроса
    const correlationId =
      (request as any).correlationId || this.generateCorrelationId();
    const userId = (request as any).user?.id;
    const ipAddress = request.ip || request.socket?.remoteAddress || 'unknown';
    const userAgent = request.get('User-Agent') || '';

    // Определяем тип ошибки и извлекаем информацию
    const errorInfo = this.extractErrorInfo(exception, correlationId);

    // Логируем ошибку с детальной информацией
    this.logError(
      exception,
      errorInfo,
      request,
      correlationId,
      userId,
      ipAddress,
      userAgent,
    );

    // Логируем события безопасности для специфических типов ошибок
    this.logSecurityEvents(
      errorInfo,
      request,
      correlationId,
      userId,
      ipAddress,
      userAgent,
    );

    // Формируем ответ в зависимости от среды
    const responseBody = this.formatResponse(errorInfo, correlationId, request);

    // Добавляем correlation ID в заголовки ответа
    response.setHeader('X-Correlation-ID', correlationId);

    // Добавляем заголовки для retry-after если применимо
    if (errorInfo.retryAfter) {
      response.setHeader('Retry-After', errorInfo.retryAfter.toString());
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, errorInfo.statusCode);
  }

  /**
   * Извлекает информацию об ошибке из различных типов исключений
   */
  private extractErrorInfo(exception: unknown, correlationId: string) {
    // UserServiceError - наш стандартизированный тип ошибки
    if (exception instanceof UserServiceError) {
      return {
        code: exception.code,
        message: exception.message,
        statusCode: exception.statusCode,
        details: exception.details,
        retryAfter: exception.getRetryAfter(),
        isOperational: exception.isOperational,
        timestamp: exception.timestamp,
      };
    }

    // HttpException - стандартные NestJS ошибки
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      let message: string;
      let validationErrors: string[] = [];
      const details: Record<string, any> = {};

      // Обрабатываем ответ от class-validator
      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse
      ) {
        const responseMessage = (exceptionResponse as { message: unknown })
          .message;
        if (Array.isArray(responseMessage)) {
          validationErrors = responseMessage.map(String);
          message = validationErrors.join(', ');
          details.fields = validationErrors;
        } else {
          message =
            typeof responseMessage === 'string'
              ? responseMessage
              : JSON.stringify(responseMessage);
        }
      } else {
        message =
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : JSON.stringify(exceptionResponse);
      }

      return {
        code: getErrorCodeFromStatus(status),
        message,
        statusCode: status,
        details,
        isOperational: true,
        timestamp: new Date(),
      };
    }

    // Обычные Error объекты
    if (exception instanceof Error) {
      return {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: exception.message || 'Внутренняя ошибка сервера',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        details: {
          name: exception.name,
          stack:
            process.env.NODE_ENV === 'development'
              ? exception.stack
              : undefined,
        },
        isOperational: false,
        timestamp: new Date(),
      };
    }

    // Неизвестный тип ошибки
    return {
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
      message: 'Неизвестная ошибка сервера',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      details: {
        type: typeof exception,
        value: String(exception),
      },
      isOperational: false,
      timestamp: new Date(),
    };
  }

  /**
   * Логирует ошибку с детальной информацией
   */
  private logError(
    exception: unknown,
    errorInfo: any,
    request: Request,
    correlationId: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): void {
    const logLevel = errorInfo.isOperational ? 'warn' : 'error';
    const message = `${errorInfo.isOperational ? 'Operational' : 'System'} error occurred: ${errorInfo.code}`;

    this.loggingService[logLevel](
      message,
      {
        correlationId,
        userId,
        operation: 'error_handling',
        ipAddress,
        userAgent,
        metadata: {
          method: request.method,
          url: request.url,
          statusCode: errorInfo.statusCode,
          errorCode: errorInfo.code,
          errorMessage: errorInfo.message,
          exceptionName:
            exception instanceof Error ? exception.name : 'Unknown',
          isOperational: errorInfo.isOperational,
          retryable: errorInfo.details?.retryable,
          retryAfter: errorInfo.retryAfter,
          userAgent,
          referer: request.get('Referer'),
          origin: request.get('Origin'),
          details: errorInfo.details,
        },
      },
      exception instanceof Error ? exception : undefined,
    );
  }

  /**
   * Логирует события безопасности для специфических типов ошибок
   */
  private logSecurityEvents(
    errorInfo: any,
    request: Request,
    correlationId: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): void {
    const { statusCode, code, message } = errorInfo;

    // События аутентификации и авторизации
    if (
      statusCode === HttpStatus.UNAUTHORIZED ||
      code === ErrorCodes.UNAUTHORIZED_ACCESS
    ) {
      this.loggingService.logSecurityEvent(
        'Unauthorized access attempt',
        userId || 'anonymous',
        correlationId,
        ipAddress || 'unknown',
        userAgent || '',
        'medium',
        {
          method: request.method,
          url: request.url,
          statusCode,
          errorCode: code,
          errorMessage: message,
        },
      );
    }

    if (
      statusCode === HttpStatus.FORBIDDEN ||
      code === ErrorCodes.FORBIDDEN_OPERATION
    ) {
      this.loggingService.logSecurityEvent(
        'Forbidden access attempt',
        userId || 'anonymous',
        correlationId,
        ipAddress || 'unknown',
        userAgent || '',
        'medium',
        {
          method: request.method,
          url: request.url,
          statusCode,
          errorCode: code,
          errorMessage: message,
        },
      );
    }

    // События превышения лимитов
    if (
      statusCode === HttpStatus.TOO_MANY_REQUESTS ||
      code === ErrorCodes.RATE_LIMIT_EXCEEDED
    ) {
      this.loggingService.logSecurityEvent(
        'Rate limit exceeded',
        userId || 'anonymous',
        correlationId,
        ipAddress || 'unknown',
        userAgent || '',
        'low',
        {
          method: request.method,
          url: request.url,
          statusCode,
          errorCode: code,
          retryAfter: errorInfo.retryAfter,
        },
      );
    }

    // Критические системные ошибки
    if (!errorInfo.isOperational && statusCode >= 500) {
      this.loggingService.logSecurityEvent(
        'Critical system error',
        userId || 'system',
        correlationId,
        ipAddress || 'unknown',
        userAgent || '',
        'critical',
        {
          method: request.method,
          url: request.url,
          statusCode,
          errorCode: code,
          errorMessage: message,
        },
      );
    }
  }

  /**
   * Форматирует ответ в зависимости от среды выполнения
   */
  private formatResponse(
    errorInfo: any,
    correlationId: string,
    request: Request,
  ): ErrorResponse | SimpleErrorResponse | ApiResponseDto<null> {
    const isTestEnv = process.env.NODE_ENV === 'test';
    const isInternalApi = request.path.startsWith('/internal');

    if (isTestEnv) {
      // Простая структура для тестов (обратная совместимость)
      if (errorInfo.details?.fields) {
        return { message: errorInfo.details.fields };
      }
      return { message: errorInfo.message };
    }

    // Для внутренних API используем старый формат для совместимости с микросервисами
    if (isInternalApi) {
      const response: ErrorResponse = {
        error: {
          code: errorInfo.code,
          message: errorInfo.message,
          correlationId,
          timestamp: errorInfo.timestamp.toISOString(),
          path: request.url,
        },
      };

      // Добавляем детали если они есть
      if (errorInfo.details && Object.keys(errorInfo.details).length > 0) {
        response.error.details = errorInfo.details;
      }

      return response;
    }

    // Для публичных API используем стандартизированный формат ApiResponseDto
    const errorMessage = errorInfo.message;
    const meta = {
      code: errorInfo.code,
      path: request.url,
      ...(errorInfo.details &&
        Object.keys(errorInfo.details).length > 0 && {
          details: errorInfo.details,
        }),
    };

    return ApiResponseDto.error(errorMessage, correlationId, null);
  }

  /**
   * Генерирует correlation ID если он отсутствует
   */
  private generateCorrelationId(): string {
    return `usr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
