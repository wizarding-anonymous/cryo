import {
  IsString,
  IsNumber,
  IsOptional,
  IsUrl,
  IsBoolean,
  IsPort,
  IsIn,
} from 'class-validator';
import { plainToClass, Transform } from 'class-transformer';

// Helper to convert string to boolean
const toBoolean = (value: string) => value === 'true';

export class EnvironmentVariables {
  @IsIn(['development', 'production', 'staging', 'test'])
  @IsString()
  NODE_ENV: string;

  @Transform(({ value }) => parseInt(value, 10))
  @IsPort()
  PORT: number;

  @IsString()
  @IsOptional()
  API_PREFIX?: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  JWT_EXPIRES_IN: string;

  @IsString()
  POSTGRES_HOST: string;

  @Transform(({ value }) => parseInt(value, 10))
  @IsPort()
  POSTGRES_PORT: number;

  @IsString()
  POSTGRES_DB: string;

  @IsString()
  POSTGRES_USER: string;

  @IsString()
  POSTGRES_PASSWORD: string;

  @IsString()
  REDIS_HOST: string;

  @Transform(({ value }) => parseInt(value, 10))
  @IsPort()
  REDIS_PORT: number;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsUrl({ require_tld: false }) // Allow localhost
  @IsString()
  ELASTICSEARCH_NODE: string;

  @IsString()
  @IsOptional()
  ELASTICSEARCH_USERNAME?: string;

  @IsString()
  @IsOptional()
  ELASTICSEARCH_PASSWORD?: string;

  @IsUrl({ require_tld: false }) // Allow localhost
  @IsString()
  S3_ENDPOINT: string;

  @IsString()
  S3_ACCESS_KEY: string;

  @IsString()
  S3_SECRET_KEY: string;

  @IsString()
  S3_BUCKET: string;

  @IsString()
  S3_REGION: string;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  S3_FORCE_PATH_STYLE: boolean;

  @IsString()
  KAFKA_BROKERS: string;

  @IsString()
  KAFKA_CLIENT_ID: string;

  @IsString()
  KAFKA_GROUP_ID: string;

  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  KAFKA_RETRIES: number;

  @IsString()
  @IsOptional()
  STEAM_API_KEY?: string;

  @IsString()
  @IsOptional()
  EPIC_GAMES_API_KEY?: string;

  @Transform(({ value }) => parseInt(value, 10))
  @IsPort()
  @IsOptional()
  PROMETHEUS_PORT: number;

  @Transform(({ value }) => parseInt(value, 10))
  @IsPort()
  @IsOptional()
  GRAFANA_PORT: number;

  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  MAX_FILE_SIZE: number;

  @IsString()
  UPLOAD_DEST: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = require('class-validator').validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(`Config validation error: ${errors.toString()}`);
  }
  return validatedConfig;
}
