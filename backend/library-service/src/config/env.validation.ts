import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  validateSync,
} from 'class-validator';
import { plainToClass, Transform } from 'class-transformer';

export class EnvironmentVariables {
  @IsNumber()
  @IsOptional()
  @Transform(({ value }: { value: string | number }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  PORT?: number = 3000;

  @IsString()
  @IsOptional()
  DATABASE_HOST?: string = 'localhost';

  @IsNumber()
  @IsOptional()
  @Transform(({ value }: { value: string | number }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  DATABASE_PORT?: number = 5432;

  @IsString()
  @IsOptional()
  DATABASE_USERNAME?: string = 'postgres';

  @IsString()
  @IsOptional()
  DATABASE_PASSWORD?: string = 'password';

  @IsString()
  @IsOptional()
  DATABASE_NAME?: string = 'library_service';

  @IsString()
  @IsOptional()
  REDIS_HOST?: string = 'localhost';

  @IsNumber()
  @IsOptional()
  @Transform(({ value }: { value: string | number }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  REDIS_PORT?: number = 6379;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }: { value: string | number }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  CACHE_TTL?: number = 300;

  @IsString()
  @IsOptional()
  JWT_SECRET?: string = 'your-secret-key';

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN?: string = '1h';

  @IsString()
  @IsOptional()
  GAMES_CATALOG_SERVICE_URL?: string = 'http://localhost:3001';

  @IsNumber()
  @IsOptional()
  @Transform(({ value }: { value: string | number }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  GAMES_CATALOG_TIMEOUT?: number = 5000;

  @IsString()
  @IsOptional()
  PAYMENT_SERVICE_URL?: string = 'http://localhost:3002';

  @IsNumber()
  @IsOptional()
  @Transform(({ value }: { value: string | number }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  PAYMENT_SERVICE_TIMEOUT?: number = 5000;

  @IsString()
  @IsOptional()
  USER_SERVICE_URL?: string = 'http://localhost:3003';

  @IsNumber()
  @IsOptional()
  @Transform(({ value }: { value: string | number }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  USER_SERVICE_TIMEOUT?: number = 5000;

  @IsString()
  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string = 'development';

  @IsNumber()
  @IsOptional()
  @Transform(({ value }: { value: string | number }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  DATABASE_MAX_CONNECTIONS?: number = 20;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }: { value: string | number }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  DATABASE_MIN_CONNECTIONS?: number = 5;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }: { value: string | number }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  DATABASE_ACQUIRE_TIMEOUT?: number = 60000;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }: { value: string | number }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  DATABASE_IDLE_TIMEOUT?: number = 600000;

  @IsString()
  @IsOptional()
  KAFKA_ENABLED?: string = 'false';

  @IsString()
  @IsOptional()
  KAFKA_BROKER?: string = 'localhost:9092';
}

export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.toString()}`);
  }

  return validatedConfig;
}
