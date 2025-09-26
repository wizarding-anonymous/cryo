import { ApiProperty } from '@nestjs/swagger';

export class HealthCheckResultDto {
  @ApiProperty({ enum: ['ok', 'error'] })
  status!: 'ok' | 'error';

  @ApiProperty({ example: new Date().toISOString() })
  timestamp!: string;

  @ApiProperty({ example: 123 })
  uptime!: number;
}

export class ServiceHealthStatusDto {
  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['healthy', 'unhealthy', 'unknown'] })
  status!: 'healthy' | 'unhealthy' | 'unknown';

  @ApiProperty({ required: false, example: 45 })
  responseTime?: number;

  @ApiProperty({ example: new Date().toISOString() })
  lastCheck!: string;

  @ApiProperty({ required: false })
  error?: string;
}
