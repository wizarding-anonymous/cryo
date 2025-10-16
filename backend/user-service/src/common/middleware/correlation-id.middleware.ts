import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Middleware для генерации и передачи correlation ID
 * Обеспечивает трассировку запросов через всю систему
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Проверяем наличие correlation ID в заголовках запроса
    let correlationId = req.headers['x-correlation-id'] as string;

    // Если correlation ID отсутствует, генерируем новый
    if (!correlationId) {
      correlationId = this.generateCorrelationId();
    }

    // Добавляем correlation ID в объект запроса для использования в контроллерах и сервисах
    (req as any).correlationId = correlationId;

    // Добавляем correlation ID в заголовки ответа
    res.setHeader('X-Correlation-ID', correlationId);

    next();
  }

  /**
   * Генерирует уникальный correlation ID
   * Формат: usr-{timestamp}-{uuid}
   */
  private generateCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const uuid = uuidv4().replace(/-/g, '').substring(0, 8);
    return `usr-${timestamp}-${uuid}`;
  }
}

/**
 * Декоратор для извлечения correlation ID из запроса
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CorrelationId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.correlationId || 'unknown';
  },
);
