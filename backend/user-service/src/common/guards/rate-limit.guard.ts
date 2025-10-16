import {
    Injectable,
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import Redis from 'ioredis';
import { Inject } from '@nestjs/common';

/**
 * Типы операций для rate limiting
 */
export enum RateLimitType {
    DEFAULT = 'default',
    BATCH = 'batch',
    PROFILE = 'profile',
    INTERNAL = 'internal',
    UPLOAD = 'upload',
    SEARCH = 'search',
}

/**
 * Конфигурация rate limiting для разных типов операций
 */
export interface RateLimitConfig {
    type: RateLimitType;
    windowMs: number; // Окно времени в миллисекундах
    maxRequests: number; // Максимальное количество запросов в окне
    skipSuccessfulRequests?: boolean; // Пропускать успешные запросы
    skipFailedRequests?: boolean; // Пропускать неудачные запросы
    keyGenerator?: (req: Request) => string; // Кастомный генератор ключей
    message?: string; // Кастомное сообщение об ошибке
}

/**
 * Метаданные для декоратора rate limiting
 */
export const RATE_LIMIT_KEY = 'rate_limit';

/**
 * Декоратор для настройки rate limiting на endpoint
 */
export const RateLimit = (config: Partial<RateLimitConfig>) => {
    return (target: any, _propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
        if (descriptor) {
            // Method decorator
            Reflect.defineMetadata(RATE_LIMIT_KEY, config, descriptor.value);
            return descriptor;
        } else {
            // Class decorator
            Reflect.defineMetadata(RATE_LIMIT_KEY, config, target);
            return target;
        }
    };
};

/**
 * Кастомный Rate Limit Guard с многоуровневой защитой
 * Поддерживает различные типы операций и интеграцию с Redis
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
    private readonly logger = new Logger(RateLimitGuard.name);
    private readonly defaultConfigs: Record<RateLimitType, RateLimitConfig>;

    constructor(
        private readonly reflector: Reflector,
        private readonly configService: ConfigService,
        @Inject('REDIS_CLIENT') private readonly redis: Redis,
    ) {
        // Конфигурации по умолчанию для разных типов операций
        this.defaultConfigs = {
            [RateLimitType.DEFAULT]: {
                type: RateLimitType.DEFAULT,
                windowMs: 60 * 1000, // 1 минута
                maxRequests: 60, // 60 запросов в минуту
                message: 'Too many requests, please try again later',
            },
            [RateLimitType.BATCH]: {
                type: RateLimitType.BATCH,
                windowMs: 5 * 60 * 1000, // 5 минут
                maxRequests: 10, // 10 batch операций в 5 минут
                message: 'Too many batch operations, please try again later',
            },
            [RateLimitType.PROFILE]: {
                type: RateLimitType.PROFILE,
                windowMs: 60 * 1000, // 1 минута
                maxRequests: 30, // 30 операций с профилем в минуту
                message: 'Too many profile operations, please try again later',
            },
            [RateLimitType.INTERNAL]: {
                type: RateLimitType.INTERNAL,
                windowMs: 60 * 1000, // 1 минута
                maxRequests: 1000, // 1000 внутренних запросов в минуту
                message: 'Too many internal requests, please try again later',
            },
            [RateLimitType.UPLOAD]: {
                type: RateLimitType.UPLOAD,
                windowMs: 60 * 1000, // 1 минута
                maxRequests: 5, // 5 загрузок в минуту
                message: 'Too many upload operations, please try again later',
            },
            [RateLimitType.SEARCH]: {
                type: RateLimitType.SEARCH,
                windowMs: 60 * 1000, // 1 минута
                maxRequests: 100, // 100 поисковых запросов в минуту
                message: 'Too many search requests, please try again later',
            },
        };

        this.logger.log('RateLimitGuard initialized with distributed Redis backend');
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        try {
            const request = context.switchToHttp().getRequest<Request>();

            // Проверяем, включен ли rate limiting
            const rateLimitEnabled = this.configService.get<boolean>('RATE_LIMIT_ENABLED', true);
            if (!rateLimitEnabled) {
                this.logger.debug('Rate limiting is disabled');
                return true;
            }

            // Получаем конфигурацию rate limiting для endpoint
            const endpointConfig = this.reflector.get<Partial<RateLimitConfig>>(
                RATE_LIMIT_KEY,
                context.getHandler(),
            );

            // Определяем тип операции
            const operationType = this.determineOperationType(request, endpointConfig);

            // Получаем финальную конфигурацию
            const config = this.mergeConfigs(operationType, endpointConfig);

            // Генерируем ключ для rate limiting
            const key = this.generateKey(request, config);

            // Проверяем rate limit
            const allowed = await this.checkRateLimit(key, config);

            if (!allowed) {
                this.logger.warn(
                    `Rate limit exceeded for key: ${key}, type: ${config.type}, IP: ${this.getClientIP(request)}`,
                );

                throw new HttpException(
                    {
                        statusCode: HttpStatus.TOO_MANY_REQUESTS,
                        message: config.message,
                        error: 'Too Many Requests',
                        type: config.type,
                        retryAfter: Math.ceil(config.windowMs / 1000),
                    },
                    HttpStatus.TOO_MANY_REQUESTS,
                );
            }

            this.logger.debug(`Rate limit check passed for key: ${key}, type: ${config.type}`);
            return true;

        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }

            this.logger.error('Error in RateLimitGuard', error);

            // В случае ошибки Redis, разрешаем запрос (fail-open)
            this.logger.warn('Rate limiting failed, allowing request (fail-open mode)');
            return true;
        }
    }

    /**
     * Определяет тип операции на основе запроса и конфигурации
     */
    private determineOperationType(
        request: Request,
        endpointConfig?: Partial<RateLimitConfig>,
    ): RateLimitType {
        // Если тип указан в конфигурации endpoint, используем его
        if (endpointConfig?.type) {
            return endpointConfig.type;
        }

        // Автоматическое определение типа на основе URL
        const path = request.path.toLowerCase();

        if (path.includes('/batch/')) {
            return RateLimitType.BATCH;
        }

        if (path.includes('/profile/') || path.includes('/avatar')) {
            return RateLimitType.PROFILE;
        }

        if (path.includes('/internal/')) {
            return RateLimitType.INTERNAL;
        }

        if (request.method === 'POST' && path.includes('/upload')) {
            return RateLimitType.UPLOAD;
        }

        if (request.method === 'GET' && (path.includes('/search') || request.query.search)) {
            return RateLimitType.SEARCH;
        }

        return RateLimitType.DEFAULT;
    }

    /**
     * Объединяет конфигурации по умолчанию с конфигурацией endpoint
     */
    private mergeConfigs(
        operationType: RateLimitType,
        endpointConfig?: Partial<RateLimitConfig>,
    ): RateLimitConfig {
        const defaultConfig = this.defaultConfigs[operationType];

        return {
            ...defaultConfig,
            ...endpointConfig,
            type: operationType,
        };
    }

    /**
     * Генерирует ключ для rate limiting
     */
    private generateKey(request: Request, config: RateLimitConfig): string {
        // Используем кастомный генератор ключей, если он предоставлен
        if (config.keyGenerator) {
            return config.keyGenerator(request);
        }

        const clientIP = this.getClientIP(request);
        const userId = (request as any).user?.id || 'anonymous';

        // Создаем составной ключ для более точного rate limiting
        const baseKey = `rate_limit:${config.type}:${clientIP}:${userId}`;

        // Для batch операций добавляем дополнительную информацию
        if (config.type === RateLimitType.BATCH) {
            const batchSize = this.getBatchSize(request);
            return `${baseKey}:batch_size_${batchSize}`;
        }

        // Для upload операций учитываем размер файла
        if (config.type === RateLimitType.UPLOAD) {
            const contentLength = request.headers['content-length'] || '0';
            return `${baseKey}:size_${contentLength}`;
        }

        return baseKey;
    }

    /**
     * Проверяет rate limit с использованием sliding window алгоритма
     */
    private async checkRateLimit(key: string, config: RateLimitConfig): Promise<boolean> {
        const now = Date.now();
        const windowStart = now - config.windowMs;

        try {
            // Используем Redis pipeline для атомарных операций
            const pipeline = this.redis.pipeline();

            // Удаляем старые записи
            pipeline.zremrangebyscore(key, 0, windowStart);

            // Добавляем текущий запрос
            pipeline.zadd(key, now, `${now}-${Math.random()}`);

            // Получаем количество запросов в окне
            pipeline.zcard(key);

            // Устанавливаем TTL для ключа
            pipeline.expire(key, Math.ceil(config.windowMs / 1000) + 1);

            const results = await pipeline.exec();

            if (!results) {
                throw new Error('Redis pipeline execution failed');
            }

            // Получаем количество запросов из результата zcard
            const requestCount = results[2][1] as number;

            this.logger.debug(
                `Rate limit check: ${requestCount}/${config.maxRequests} for key: ${key}`,
            );

            return requestCount <= config.maxRequests;

        } catch (error) {
            this.logger.error(`Redis error in rate limiting: ${error.message}`);

            // В случае ошибки Redis, используем fallback (разрешаем запрос)
            return true;
        }
    }

    /**
     * Получает размер batch операции из запроса
     */
    private getBatchSize(request: Request): number {
        try {
            if (request.method === 'POST' && request.body) {
                if (Array.isArray(request.body.users)) {
                    return request.body.users.length;
                }
                if (Array.isArray(request.body.ids)) {
                    return request.body.ids.length;
                }
            }

            if (request.method === 'GET' && request.query.ids) {
                const ids = Array.isArray(request.query.ids)
                    ? request.query.ids
                    : String(request.query.ids).split(',');
                return ids.length;
            }

            return 1;
        } catch (error) {
            this.logger.warn(`Error determining batch size: ${error.message}`);
            return 1;
        }
    }

    /**
     * Получает IP адрес клиента
     */
    private getClientIP(request: Request): string {
        const forwarded = request.headers['x-forwarded-for'] as string;
        const realIP = request.headers['x-real-ip'] as string;
        const remoteAddress = request.socket?.remoteAddress;

        if (forwarded) {
            return forwarded.split(',')[0].trim();
        }

        if (realIP) {
            return realIP;
        }

        return remoteAddress || 'unknown';
    }
}