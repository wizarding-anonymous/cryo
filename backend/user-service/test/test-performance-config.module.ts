import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from '../src/config/config.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.test',
      // Disable validation for performance tests since we use in-memory SQLite
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
        skipMissingProperties: true,
      },
      // Provide default values for required config
      load: [
        () => ({
          NODE_ENV: 'test',
          PORT: 3000,
          // SQLite doesn't need these, but config might reference them
          POSTGRES_HOST: 'localhost',
          POSTGRES_PORT: 5432,
          POSTGRES_USER: 'test',
          POSTGRES_PASSWORD: 'test',
          POSTGRES_DB: 'test',
          REDIS_HOST: 'localhost',
          REDIS_PORT: 6379,
          JWT_SECRET: 'test-secret',
          ENCRYPTION_KEY: 'test-encryption-key-32-characters',
          INTERNAL_API_KEYS: 'test-api-key',
          INTERNAL_ALLOWED_IPS: '127.0.0.1,::1',
          INTERNAL_SERVICE_SECRET: 'test-secret',
        }),
      ],
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class TestPerformanceConfigModule {}