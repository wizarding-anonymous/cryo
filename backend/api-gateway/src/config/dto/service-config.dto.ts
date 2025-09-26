import { IsInt, IsOptional, IsString, IsUrl, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CircuitBreakerConfigDto {
  @ApiProperty({ 
    description: 'Number of failures before circuit opens',
    example: 5,
    minimum: 1
  })
  @IsInt()
  @Min(1)
  failureThreshold!: number;

  @ApiProperty({ 
    description: 'Time in milliseconds before attempting to close circuit',
    example: 30000,
    minimum: 1000
  })
  @IsInt()
  @Min(1000)
  resetTimeout!: number;

  @ApiProperty({ 
    description: 'Monitoring period in milliseconds',
    example: 60000,
    minimum: 1000
  })
  @IsInt()
  @Min(1000)
  monitoringPeriod!: number;
}

export class ServiceConfigDto {
  @ApiProperty({ 
    description: 'Service name',
    example: 'user-service'
  })
  @IsString()
  name!: string;

  @ApiProperty({ 
    description: 'Base URL of the service',
    example: 'http://user-service:3001'
  })
  @IsString()
  baseUrl!: string;

  @ApiProperty({ 
    description: 'Request timeout in milliseconds',
    example: 5000,
    minimum: 1000
  })
  @IsInt()
  @Min(1000)
  timeout!: number;

  @ApiProperty({ 
    description: 'Number of retry attempts',
    example: 3,
    minimum: 0
  })
  @IsInt()
  @Min(0)
  retries!: number;

  @ApiProperty({ 
    description: 'Health check endpoint path',
    example: '/health'
  })
  @IsString()
  healthCheckPath!: string;

  @ApiPropertyOptional({ 
    description: 'Circuit breaker configuration',
    type: CircuitBreakerConfigDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CircuitBreakerConfigDto)
  circuitBreaker?: CircuitBreakerConfigDto;
}