import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
    protected async throwThrottlingException(
        context: ExecutionContext,
        throttlerLimitDetail: {
            totalHits: number;
            timeToExpire: number;
        },
    ): Promise<void> {
        const request = context.switchToHttp().getRequest();
        const endpoint = `${request.method} ${request.url}`;

        // Determine if this is an authentication endpoint for specific messaging
        const isAuthEndpoint = request.url.includes('/auth/login') ||
            request.url.includes('/auth/register');

        let message: string;
        if (isAuthEndpoint) {
            message = 'Слишком много попыток аутентификации. Попробуйте снова через несколько минут.';
        } else {
            message = 'Слишком много запросов. Попробуйте снова позже.';
        }

        // Log the rate limiting event
        console.log(`Rate limit exceeded for ${endpoint}. Total hits: ${throttlerLimitDetail.totalHits}, Time to expire: ${throttlerLimitDetail.timeToExpire}ms`);

        throw new ThrottlerException(message);
    }
}