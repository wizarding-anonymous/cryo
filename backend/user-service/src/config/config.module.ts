import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { AppConfigService } from './config.service';
import { StartupValidationService } from './startup-validation.service';
import { envValidationSchema } from './env.validation';
import { mergeEnvironmentConfig } from './environments';
import { ConfigFactory } from './config.factory';
import { EnvironmentVariables } from './env.validation';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: getEnvFilePaths(),
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
      load: [
        () => {
          const nodeEnv = process.env.NODE_ENV || 'development';

          // Get current environment variables
          const envVars = { ...process.env };

          // Merge with environment-specific defaults
          const config = mergeEnvironmentConfig(nodeEnv, envVars);

          return config;
        },
      ],
    }),
    // Add CacheModule here to make CACHE_MANAGER available for StartupValidationService
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables>) => {
        const configFactory = new ConfigFactory(configService);
        return configFactory.createCacheConfig();
      },
    }),
  ],
  providers: [AppConfigService, StartupValidationService],
  exports: [AppConfigService, StartupValidationService, CacheModule],
})
export class AppConfigModule {}

/**
 * Get environment file paths based on NODE_ENV
 */
function getEnvFilePaths(): string[] {
  const nodeEnv = process.env.NODE_ENV || 'development';

  const paths: string[] = [];

  // Environment-specific files first (highest priority)
  paths.push(`.env.${nodeEnv}.local`);
  paths.push(`.env.${nodeEnv}`);

  // Local override file
  if (nodeEnv !== 'production') {
    paths.push('.env.local');
  }

  // Default env file (lowest priority)
  paths.push('.env');

  return paths;
}
