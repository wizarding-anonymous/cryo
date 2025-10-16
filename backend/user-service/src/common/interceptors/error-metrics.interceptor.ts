import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MetricsService } from '../metrics/metrics.service';
import { UserServiceError } from '../errors';

/**
 * Интерцептор для сбора метрик ошибок
 * Отслеживает количество и типы ошибок для мониторинга
 */
@Injectable()
export class ErrorMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const route = this.extractRoute(context);

    return next.handle().pipe(
      catchError((error) => {
        // Собираем метрики для различных типов ошибок
        this.collectErrorMetrics(error, method, route);

        // Пробрасываем ошибку дальше
        return throwError(() => error);
      }),
    );
  }

  /**
   * Собирает метрики ошибок
   */
  private collectErrorMetrics(error: any, method: string, route: string): void {
    const errorType = this.getErrorType(error);
    const errorCode = this.getErrorCode(error);
    const statusCode = this.getStatusCode(error);
    const isOperational = this.isOperationalError(error);

    // Записываем операцию как ошибочную
    this.metricsService.recordUserOperation(
      `${method.toLowerCase()}_${route}`,
      'error',
    );

    // Записываем внешний вызов как ошибочный если это ошибка внешнего сервиса
    if (this.isExternalServiceError(error)) {
      this.metricsService.recordExternalServiceCall(
        this.getServiceName(error),
        'api_call',
        'error',
      );
    }

    // Записываем операцию с базой данных как ошибочную если это ошибка БД
    if (this.isDatabaseError(error)) {
      this.metricsService.recordDatabaseOperation('query', 'users', 'error');
    }

    // Логируем детали ошибки для дальнейшего анализа
    console.error('Error metrics collected:', {
      errorType,
      errorCode,
      statusCode,
      isOperational,
      method,
      route,
      retryable: this.isRetryableError(error),
      critical: this.isCriticalError(error),
    });
  }

  /**
   * Определяет тип ошибки
   */
  private getErrorType(error: any): string {
    if (error instanceof UserServiceError) {
      return 'UserServiceError';
    }
    if (error.name) {
      return error.name;
    }
    return 'UnknownError';
  }

  /**
   * Получает код ошибки
   */
  private getErrorCode(error: any): string {
    if (error instanceof UserServiceError) {
      return error.code;
    }
    if (error.code) {
      return error.code;
    }
    return 'UNKNOWN_ERROR';
  }

  /**
   * Получает HTTP статус код
   */
  private getStatusCode(error: any): number {
    if (error instanceof UserServiceError) {
      return error.statusCode;
    }
    if (error.status) {
      return error.status;
    }
    if (error.statusCode) {
      return error.statusCode;
    }
    return 500;
  }

  /**
   * Проверяет, является ли ошибка операционной
   */
  private isOperationalError(error: any): boolean {
    if (error instanceof UserServiceError) {
      return error.isOperational;
    }
    // Считаем HTTP ошибки операционными
    return error.status && error.status < 500;
  }

  /**
   * Проверяет, является ли ошибка критической
   */
  private isCriticalError(error: any): boolean {
    const statusCode = this.getStatusCode(error);
    const isOperational = this.isOperationalError(error);

    // Критические ошибки - это неоперационные ошибки 5xx уровня
    return !isOperational && statusCode >= 500;
  }

  /**
   * Проверяет, можно ли повторить операцию
   */
  private isRetryableError(error: any): boolean {
    if (error instanceof UserServiceError) {
      return error.isRetryable();
    }

    const statusCode = this.getStatusCode(error);
    // Считаем повторяемыми ошибки 5xx и некоторые 4xx
    return statusCode >= 500 || statusCode === 429 || statusCode === 408;
  }

  /**
   * Проверяет, является ли ошибка ошибкой внешнего сервиса
   */
  private isExternalServiceError(error: any): boolean {
    if (error instanceof UserServiceError) {
      return [
        'AUTH_SERVICE_UNAVAILABLE',
        'GAME_CATALOG_SERVICE_UNAVAILABLE',
        'PAYMENT_SERVICE_UNAVAILABLE',
        'EXTERNAL_SERVICE_ERROR',
      ].includes(error.code);
    }
    return false;
  }

  /**
   * Проверяет, является ли ошибка ошибкой базы данных
   */
  private isDatabaseError(error: any): boolean {
    if (error instanceof UserServiceError) {
      return [
        'DATABASE_ERROR',
        'DATABASE_CONNECTION_FAILED',
        'DATABASE_QUERY_FAILED',
        'DATABASE_CONSTRAINT_VIOLATION',
      ].includes(error.code);
    }
    return false;
  }

  /**
   * Получает имя сервиса из ошибки внешнего сервиса
   */
  private getServiceName(error: any): string {
    if (
      error instanceof UserServiceError &&
      error.details?.context?.serviceName
    ) {
      return error.details.context.serviceName;
    }
    return 'unknown';
  }

  /**
   * Извлекает маршрут из контекста выполнения
   */
  private extractRoute(context: ExecutionContext): string {
    const handler = context.getHandler();
    const controller = context.getClass();

    // Пытаемся получить имя маршрута из метаданных
    const controllerName = controller.name
      .replace('Controller', '')
      .toLowerCase();
    const handlerName = handler.name;

    return `${controllerName}.${handlerName}`;
  }
}
