import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('rateLimit.ttl', 60) * 1000,
          limit: configService.get<number>('rateLimit.limit', 100),
          skipSuccessfulRequests: configService.get<boolean>(
            'rateLimit.skipSuccessfulRequests',
            false,
          ),
        },
      ],
    }),
  ],
  exports: [ThrottlerModule],
})
export class SecurityModule {}
