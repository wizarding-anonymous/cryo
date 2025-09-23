import { developmentConfig } from './environments/development.config';
import { testConfig } from './environments/test.config';
import { productionConfig } from './environments/production.config';

type EnvConfigFactory = () => Record<string, unknown>;

const ENV_CONFIG_MAP: Record<string, EnvConfigFactory> = {
  development: developmentConfig,
  test: testConfig,
  production: productionConfig,
};

export const configuration = () => {
  const environment = process.env.NODE_ENV || 'development';
  const factory = ENV_CONFIG_MAP[environment] || developmentConfig;

  return {
    environment,
    ...factory(),
  };
};
