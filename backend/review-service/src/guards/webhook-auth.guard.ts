import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class WebhookAuthGuard implements CanActivate {
  private readonly logger = new Logger(WebhookAuthGuard.name);
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.webhookSecret = this.configService.get<string>('WEBHOOK_SECRET') || 'default-webhook-secret';
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    
    try {
      return this.validateWebhookSignature(request);
    } catch (error) {
      this.logger.error('Webhook authentication failed', error);
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  private validateWebhookSignature(request: Request): boolean {
    const providedSecret = request.headers['x-webhook-secret'] as string;
    const providedSignature = request.headers['x-webhook-signature'] as string;
    const timestamp = request.headers['x-webhook-timestamp'] as string;

    // Проверяем наличие обязательных заголовков
    if (!providedSecret && !providedSignature) {
      this.logger.warn('Missing webhook authentication headers');
      throw new UnauthorizedException('Missing webhook authentication headers');
    }

    // Метод 1: Простая проверка секретного ключа (для внутренних сервисов)
    if (providedSecret) {
      if (providedSecret !== this.webhookSecret) {
        this.logger.warn('Invalid webhook secret provided');
        throw new UnauthorizedException('Invalid webhook secret');
      }
      return true;
    }

    // Метод 2: HMAC подпись (для внешних интеграций)
    if (providedSignature) {
      return this.validateHmacSignature(request, providedSignature, timestamp);
    }

    throw new UnauthorizedException('No valid authentication method provided');
  }

  private validateHmacSignature(request: Request, providedSignature: string, timestamp: string): boolean {
    // Проверяем временную метку (защита от replay атак)
    if (timestamp) {
      const requestTime = parseInt(timestamp, 10);
      const currentTime = Math.floor(Date.now() / 1000);
      const timeDifference = Math.abs(currentTime - requestTime);

      // Разрешаем запросы не старше 5 минут
      if (timeDifference > 300) {
        this.logger.warn(`Webhook request too old: ${timeDifference} seconds`);
        throw new UnauthorizedException('Webhook request timestamp too old');
      }
    }

    // Получаем тело запроса для вычисления подписи
    const rawBody = JSON.stringify(request.body);
    const payload = timestamp ? `${timestamp}.${rawBody}` : rawBody;

    // Вычисляем HMAC подпись
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload, 'utf8')
      .digest('hex');

    const expectedSignatureWithPrefix = `sha256=${expectedSignature}`;

    // Сравниваем подписи безопасным способом
    const isValid = crypto.timingSafeEqual(
      Buffer.from(providedSignature, 'utf8'),
      Buffer.from(expectedSignatureWithPrefix, 'utf8')
    );

    if (!isValid) {
      this.logger.warn('Invalid HMAC signature provided');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }
}