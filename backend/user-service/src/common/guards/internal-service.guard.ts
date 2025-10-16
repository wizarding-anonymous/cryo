import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Guard для защиты внутренних API endpoints от внешних вызовов.
 * Проверяет API ключи, IP адреса и специальные заголовки для межсервисной коммуникации.
 */
@Injectable()
export class InternalServiceGuard implements CanActivate {
  private readonly logger = new Logger(InternalServiceGuard.name);
  private readonly allowedApiKeys: string[];
  private readonly allowedIPs: string[];
  private readonly requiredHeaders: Record<string, string>;

  constructor(private readonly configService: ConfigService) {
    // Получаем конфигурацию для внутренних сервисов
    const apiKeysString = this.configService.get<string>(
      'INTERNAL_API_KEYS',
      '',
    );
    this.allowedApiKeys = (apiKeysString || '')
      .split(',')
      .filter((key) => key.trim())
      .map((key) => key.trim());

    const allowedIPsString = this.configService.get<string>(
      'INTERNAL_ALLOWED_IPS',
      '127.0.0.1,::1',
    );
    this.allowedIPs = (allowedIPsString || '127.0.0.1,::1')
      .split(',')
      .filter((ip) => ip.trim())
      .map((ip) => ip.trim());

    // Специальные заголовки для внутренних сервисов
    this.requiredHeaders = {
      'x-internal-service': this.configService.get<string>(
        'INTERNAL_SERVICE_SECRET',
        'user-service-internal',
      ),
    };

    this.logger.log(
      `InternalServiceGuard initialized with ${this.allowedApiKeys.length} API keys and ${this.allowedIPs.length} allowed IPs`,
    );
  }

  canActivate(context: ExecutionContext): boolean {
    try {
      const request = context.switchToHttp().getRequest<Request>();
      const clientIP = this.getClientIP(request);
      const userAgent = request.headers['user-agent'] || 'unknown';
      const endpoint = `${request.method} ${request.url}`;

      this.logger.debug(`Internal API access attempt from IP: ${clientIP}, endpoint: ${endpoint}`);

      // 1. Проверка API ключа
      const apiKeyResult = this.checkApiKey(request);
      if (apiKeyResult.valid) {
        this.logger.log(`Access granted via API key (${apiKeyResult.method}) from IP: ${clientIP}, endpoint: ${endpoint}`);
        this.logSecurityEvent('API_KEY_ACCESS', clientIP, userAgent, endpoint, true);
        return true;
      }

      // 2. Проверка IP адреса (для локальной разработки и Docker)
      if (this.checkIPAddress(clientIP)) {
        this.logger.debug(`Access granted via IP whitelist: ${clientIP}, endpoint: ${endpoint}`);
        this.logSecurityEvent('IP_WHITELIST_ACCESS', clientIP, userAgent, endpoint, true);
        return true;
      }

      // 3. Проверка специальных заголовков
      if (this.checkInternalHeaders(request)) {
        this.logger.debug(`Access granted via internal headers from IP: ${clientIP}, endpoint: ${endpoint}`);
        this.logSecurityEvent('INTERNAL_HEADER_ACCESS', clientIP, userAgent, endpoint, true);
        return true;
      }

      // 4. В режиме разработки разрешаем доступ с localhost
      if (this.isDevelopmentMode() && this.isLocalhost(clientIP)) {
        this.logger.warn(
          `Development mode: allowing access from localhost ${clientIP}, endpoint: ${endpoint}`,
        );
        this.logSecurityEvent('DEV_LOCALHOST_ACCESS', clientIP, userAgent, endpoint, true);
        return true;
      }

      // Логируем неудачную попытку доступа
      this.logger.warn(
        `Access denied for IP: ${clientIP}, endpoint: ${endpoint}, no valid credentials found`,
      );
      this.logSecurityEvent('ACCESS_DENIED', clientIP, userAgent, endpoint, false);
      
      throw new UnauthorizedException(
        'Access denied: Internal API requires valid credentials',
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error('Error in InternalServiceGuard', error);
      throw new UnauthorizedException(
        'Access denied: Internal service authentication failed',
      );
    }
  }

  /**
   * Проверяет API ключ в заголовке Authorization или x-api-key
   */
  private checkApiKey(request: Request): { valid: boolean; method?: string } {
    const authHeader = request.headers.authorization;
    const apiKeyHeader = request.headers['x-api-key'] as string;

    // Проверяем Bearer токен
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (this.isValidApiKey(token)) {
        return { valid: true, method: 'Bearer' };
      }
    }

    // Проверяем x-api-key заголовок
    if (apiKeyHeader && this.isValidApiKey(apiKeyHeader)) {
      return { valid: true, method: 'X-API-Key' };
    }

    return { valid: false };
  }

  /**
   * Проверяет валидность API ключа с дополнительными проверками безопасности
   */
  private isValidApiKey(apiKey: string): boolean {
    // Базовая проверка на наличие в списке разрешенных
    if (!this.allowedApiKeys.includes(apiKey)) {
      return false;
    }

    // Дополнительные проверки безопасности
    if (apiKey.length < 16) {
      this.logger.warn('API key too short, potential security risk');
      return false;
    }

    // Проверка на простые паттерны (например, "test", "dev", "123")
    const weakPatterns = ['test', 'dev', 'demo', '123', 'password', 'secret'];
    const lowerKey = apiKey.toLowerCase();
    if (weakPatterns.some(pattern => lowerKey.includes(pattern))) {
      this.logger.warn('API key contains weak patterns, potential security risk');
      return false;
    }

    return true;
  }

  /**
   * Проверяет IP адрес клиента с поддержкой CIDR нотации
   */
  private checkIPAddress(clientIP: string): boolean {
    // Прямое сравнение IP адресов
    if (this.allowedIPs.includes(clientIP)) {
      return true;
    }

    // Проверка CIDR диапазонов
    for (const allowedIP of this.allowedIPs) {
      if (allowedIP.includes('/')) {
        if (this.isIPInCIDR(clientIP, allowedIP)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Проверяет, находится ли IP адрес в CIDR диапазоне
   */
  private isIPInCIDR(ip: string, cidr: string): boolean {
    try {
      const [network, prefixLength] = cidr.split('/');
      const prefix = parseInt(prefixLength, 10);

      // Поддержка только IPv4 для простоты
      if (!this.isValidIPv4(ip) || !this.isValidIPv4(network)) {
        return false;
      }

      const ipNum = this.ipToNumber(ip);
      const networkNum = this.ipToNumber(network);
      const mask = (0xffffffff << (32 - prefix)) >>> 0;

      return (ipNum & mask) === (networkNum & mask);
    } catch (error) {
      this.logger.warn(`Invalid CIDR notation: ${cidr}`, error);
      return false;
    }
  }

  /**
   * Проверяет валидность IPv4 адреса
   */
  private isValidIPv4(ip: string): boolean {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;

    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255 && part === num.toString();
    });
  }

  /**
   * Преобразует IP адрес в число
   */
  private ipToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  /**
   * Проверяет специальные заголовки для внутренних сервисов
   */
  private checkInternalHeaders(request: Request): boolean {
    for (const [headerName, expectedValue] of Object.entries(
      this.requiredHeaders,
    )) {
      const headerValue = request.headers[headerName] as string;
      if (headerValue === expectedValue) {
        return true;
      }
    }
    return false;
  }

  /**
   * Получает реальный IP адрес клиента с учетом прокси
   */
  private getClientIP(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'] as string;
    const realIP = request.headers['x-real-ip'] as string;
    const remoteAddress = request.socket?.remoteAddress;

    if (forwarded) {
      // x-forwarded-for может содержать несколько IP через запятую
      return forwarded.split(',')[0].trim();
    }

    if (realIP) {
      return realIP;
    }

    return remoteAddress || 'unknown';
  }

  /**
   * Проверяет, является ли IP адрес localhost
   */
  private isLocalhost(ip: string): boolean {
    const localhostIPs = ['127.0.0.1', '::1', 'localhost', '0.0.0.0'];
    return (
      localhostIPs.includes(ip) ||
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      ip.startsWith('172.')
    );
  }

  /**
   * Проверяет, работает ли приложение в режиме разработки
   */
  private isDevelopmentMode(): boolean {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    return nodeEnv === 'development' || nodeEnv === 'test';
  }

  /**
   * Логирует события безопасности для аудита
   */
  private logSecurityEvent(
    eventType: string,
    clientIP: string,
    userAgent: string,
    endpoint: string,
    success: boolean,
  ): void {
    const securityEvent = {
      timestamp: new Date().toISOString(),
      eventType,
      clientIP,
      userAgent,
      endpoint,
      success,
      service: 'user-service',
      guard: 'InternalServiceGuard',
    };

    // В production отправляем в Security Service для централизованного аудита
    if (!this.isDevelopmentMode()) {
      // TODO: Интеграция с Security Service для отправки событий безопасности
      this.logger.log(`Security event: ${JSON.stringify(securityEvent)}`);
    } else {
      this.logger.debug(`Security event: ${JSON.stringify(securityEvent)}`);
    }
  }
}
