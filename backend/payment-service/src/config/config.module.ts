import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { configuration } from './configuration';
import { envValidationSchema } from './env.validation';
import { AppConfigService } from './app.config';
import { ConfigValidationService } from './config-validation.service';
import { DatabaseConfig } from './database.config';
import { CacheConfig } from './cache.config';
import { JwtConfig } from './jwt.config';
import { ThrottlerConfig } from './throttler.config';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}.local`,
        `.env.${process.env.NODE_ENV || 'development'}`,
        '.env.local',
        '.env',
      ],
      expandVariables: true,
      cache: true,
    }),
  ],
  providers: [
    AppConfigService,
    ConfigValidationService,
    DatabaseConfig,
    CacheConfig,
    JwtConfig,
    ThrottlerConfig,
  ],
  exports: [
    NestConfigModule,
    AppConfigService,
    ConfigValidationService,
    DatabaseConfig,
    CacheConfig,
    JwtConfig,
    ThrottlerConfig,
  ],
})
export class ConfigModule {}
