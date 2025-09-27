import { ApiProperty } from '@nestjs/swagger';

export interface HealthStatus {
  name: string;
  status: 'healthy' | 'unhealthy';
  message: string;
}

export class HealthResponseDto {
  @ApiProperty({
    description: 'Статус здоровья сервиса',
    enum: ['healthy', 'unhealthy', 'ready', 'not_ready', 'alive'],
    example: 'healthy',
  })
  status: string = 'healthy';

  @ApiProperty({
    description: 'Временная метка проверки',
    example: '2024-01-15T10:30:00.000Z',
  })
  timestamp: string = new Date().toISOString();

  @ApiProperty({
    description: 'Название сервиса',
    example: 'achievement-service',
  })
  service: string = 'achievement-service';

  @ApiProperty({
    description: 'Версия сервиса',
    example: '1.0.0',
  })
  version: string = '1.0.0';

  @ApiProperty({
    description: 'Детальные проверки компонентов',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'database' },
        status: { type: 'string', enum: ['healthy', 'unhealthy'], example: 'healthy' },
        message: { type: 'string', example: 'Database connection is healthy' },
      },
    },
  })
  checks: HealthStatus[] = [];
}
