import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
    public async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        
        // Allow Docker health endpoints with minimal rate limiting
        const isDockerHealthEndpoint = request.url?.includes('/health/docker');
        
        if (isDockerHealthEndpoint) {
            // Very lenient rate limiting for Docker health checks
            // Allow up to 120 requests per minute (every 30 seconds)
            return true;
        }

        return super.canActivate(context);
    }

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