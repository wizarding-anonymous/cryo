import { EnvironmentVariables } from '../env.validation';
import { developmentConfig } from './development.config';
import { productionConfig } from './production.config';
import { testConfig } from './test.config';

export interface EnvironmentConfig {
  [key: string]: Partial<EnvironmentVariables>;
}

export const environmentConfigs: EnvironmentConfig = {
  development: developmentConfig,
  production: productionConfig,
  test: testConfig,
};

/**
 * Get environment-specific configuration defaults
 * These can be overridden by actual environment variables
 */
export function getEnvironmentDefaults(nodeEnv: string): Partial<EnvironmentVariables> {
  const config = environmentConfigs[nodeEnv];
  if (!config) {
    throw new Error(`No configuration found for environment: ${nodeEnv}`);
  }
  return config;
}

/**
 * Merge environment defaults with actual environment variables
 * Environment variables take precedence over defaults
 */
export function mergeEnvironmentConfig(
  nodeEnv: string,
  envVars: Record<string, any>
): Record<string, any> {
  const defaults = getEnvironmentDefaults(nodeEnv);
  
  // Merge defaults with environment variables
  // Environment variables override defaults
  const merged = { ...defaults, ...envVars };
  
  // Remove undefined values
  Object.keys(merged).forEach(key => {
    if (merged[key] === undefined) {
      delete merged[key];
    }
  });
  
  return merged;
}

export { developmentConfig, productionConfig, testConfig };