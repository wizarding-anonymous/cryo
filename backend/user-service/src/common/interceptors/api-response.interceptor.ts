import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { ApiResponseDto } from '../dto/api-response.dto';

/**
 * Интерцептор для стандартизации всех API ответов
 * Оборачивает все успешные ответы в стандартный формат ApiResponseDto
 */
@Injectable()
export class ApiResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponseDto<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponseDto<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const correlationId =
      (request as any).correlationId ||
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return next.handle().pipe(
      map((data: any): ApiResponseDto<T> => {
        // Если данные уже обернуты в ApiResponseDto, возвращаем как есть
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          'timestamp' in data
        ) {
          return data as ApiResponseDto<T>;
        }

        // Если это пагинированный ответ, добавляем мета-информацию
        if (
          data &&
          typeof data === 'object' &&
          'items' in data &&
          'pagination' in data
        ) {
          const paginationMeta = data.pagination as Record<string, any>;
          return ApiResponseDto.success(
            data as T,
            {
              pagination: paginationMeta,
            },
            correlationId,
          );
        }

        // Стандартный успешный ответ
        return ApiResponseDto.success(data as T, null, correlationId);
      }),
    );
  }
}

/**
 * Интерцептор специально для внутренних API
 * Не оборачивает ответы в стандартный формат для совместимости с другими микросервисами
 */
@Injectable()
export class InternalApiResponseInterceptor<T>
  implements NestInterceptor<T, T>
{
  intercept(context: ExecutionContext, next: CallHandler): Observable<T> {
    // Для внутренних API возвращаем данные как есть
    return next.handle();
  }
}
