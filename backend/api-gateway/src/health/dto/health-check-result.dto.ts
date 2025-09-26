import { IsArray, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { HealthStatus, ServiceHealthStatus } from '../../common/enums/health-status.enum';

export class ServiceHealthStatusDto {
  @ApiProperty({ 
    description: 'Service name',
    example: 'user-service'
  })
  @IsString()
  name!: string;

  @ApiProperty({ 
    enum: ServiceHealthStatus,
    description: 'Service health status'
  })
  @IsEnum(ServiceHealthStatus)
  status!: ServiceHealthStatus;

  @ApiProperty({ 
    description: 'Response time in milliseconds',
    example: 150,
    minimum: 0,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  responseTime?: number;

  @ApiProperty({ 
    description: 'Last health check timestamp',
    example: '2024-01-15T10:30:00.000Z'
  })
  @IsString()
  lastCheck!: string;

  @ApiProperty({ 
    description: 'Error message if unhealthy',
    example: 'Connection timeout',
    required: false
  })
  @IsOptional()
  @IsString()
  error?: string;
}

export class HealthCheckResultDto {
  @ApiProperty({ 
    enum: HealthStatus,
    description: 'Overall health status'
  })
  @IsEnum(HealthStatus)
  status!: HealthStatus;

  @ApiProperty({ 
    description: 'Health check timestamp',
    example: '2024-01-15T10:30:00.000Z'
  })
  @IsString()
  timestamp!: string;

  @ApiProperty({ 
    description: 'Service uptime in seconds',
    example: 3600,
    minimum: 0
  })
  @IsNumber()
  @Min(0)
  uptime!: number;

  @ApiProperty({ 
    description: 'Health status of all services',
    type: [ServiceHealthStatusDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceHealthStatusDto)
  services!: ServiceHealthStatusDto[];
}