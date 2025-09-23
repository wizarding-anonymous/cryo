import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { HealthResponseDto } from './dto/health-response.dto';
import { Public } from '../achievement/decorators';

@Controller('health')
@ApiTags('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Public()
  @ApiOperation({ 
    summary: 'Общий health check',
    description: 'Проверяет общее состояние сервиса для Kubernetes liveness probe'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Сервис работает корректно',
    type: HealthResponseDto
  })
  @ApiResponse({ 
    status: 503, 
    description: 'Сервис недоступен'
  })
  async getHealth(): Promise<HealthResponseDto> {
    return this.healthService.getHealth();
  }

  @Get('ready')
  @Public()
  @ApiOperation({ 
    summary: 'Readiness probe',
    description: 'Проверяет готовность сервиса к обработке запросов для Kubernetes readiness probe'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Сервис готов к обработке запросов',
    type: HealthResponseDto
  })
  @ApiResponse({ 
    status: 503, 
    description: 'Сервис не готов к обработке запросов'
  })
  async getReadiness(): Promise<HealthResponseDto> {
    return this.healthService.getReadiness();
  }

  @Get('live')
  @Public()
  @ApiOperation({ 
    summary: 'Liveness probe',
    description: 'Проверяет жизнеспособность сервиса для Kubernetes liveness probe'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Сервис жив',
    type: HealthResponseDto
  })
  @ApiResponse({ 
    status: 503, 
    description: 'Сервис мертв'
  })
  async getLiveness(): Promise<HealthResponseDto> {
    return this.healthService.getLiveness();
  }
}