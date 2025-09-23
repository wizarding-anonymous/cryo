import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './config.service';
import { StartupValidationService } from './startup-validation.service';
import { envValidationSchema } from './env.validation';
import { mergeEnvironmentConfig } from './environments';

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
  ],
  providers: [AppConfigService, StartupValidationService],
  exports: [AppConfigService, StartupValidationService],
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
