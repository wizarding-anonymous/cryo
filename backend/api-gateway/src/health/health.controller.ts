import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheckResultDto, ServiceHealthStatusDto } from './dto/health.dto';

@ApiTags('Health')
@Controller('v1/health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Gateway health check' })
  @ApiOkResponse({ type: HealthCheckResultDto })
  async checkHealth(): Promise<HealthCheckResultDto> {
    return this.healthService.checkGateway();
  }

  @Get('services')
  @ApiOperation({ summary: 'Health check for all registered services' })
  @ApiOkResponse({ type: ServiceHealthStatusDto, isArray: true })
  async checkServicesHealth(): Promise<ServiceHealthStatusDto[]> {
    return this.healthService.checkServices();
  }
}
