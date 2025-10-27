import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { AppConfigModule } from '../../config/config.module';

@Module({
  imports: [AppConfigModule],
  providers: [
    RedisService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: async (redisService: RedisService) => {
        // Wait for Redis to be ready before providing the client
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
          const client = redisService.getClient();
          if (client && redisService.isReady()) {
            return client;
          }

          // Wait 500ms before next attempt
          await new Promise((resolve) => setTimeout(resolve, 500));
          attempts++;
        }

        // Return the actual client or a safe fallback
        const client = redisService.getClient();
        if (client) {
          return client;
        }

        // Return a safe proxy that handles undefined client
        return new Proxy(
          {},
          {
            get(target, prop) {
              const currentClient = redisService.getClient();
              if (!currentClient) {
                // Return a no-op function for Redis methods to prevent crashes
                if (typeof prop === 'string') {
                  if (prop === 'pipeline') {
                    return () => ({
                      zremrangebyscore: () => ({}),
                      zadd: () => ({}),
                      zcard: () => ({}),
                      expire: () => ({}),
                      exec: () => Promise.resolve(null),
                    });
                  }
                  if (['get', 'set', 'del', 'ping'].includes(prop)) {
                    return () => Promise.resolve(null);
                  }
                }
                return undefined;
              }
              const value = (currentClient as any)[prop];
              return typeof value === 'function'
                ? value.bind(currentClient)
                : value;
            },
          },
        );
      },
      inject: [RedisService],
    },
  ],
  exports: [RedisService, 'REDIS_CLIENT'],
})
export class RedisModule {}
