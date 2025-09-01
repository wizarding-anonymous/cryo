import { Controller, Get, Post, UseGuards, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrationMonitoringService } from '../../../application/services/integration-monitoring.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('integration-monitoring')
@Controller('integration-monitoring')
export class IntegrationMonitoringController {
  constructor(private readonly integrationMonitoringService: IntegrationMonitoringService) {}

  @Get('health')
  @ApiOperation({ summary: 'Получить статус здоровья всех интеграций' })
  @ApiResponse({ status: 200, description: 'Статус интеграций' })
  async getIntegrationHealth() {
    const statuses = this.integrationMonitoringService.getIntegrationStatuses();
    const summary = this.integrationMonitoringService.getIntegrationSummary();

    return {
      summary,
      integrations: statuses,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health/:serviceName')
  @ApiOperation({ summary: 'Получить статус здоровья конкретной интеграции' })
  @ApiResponse({ status: 200, description: 'Статус интеграции' })
  @ApiResponse({ status: 404, description: 'Интеграция не найдена' })
  async getServiceHealth(@Param('serviceName') serviceName: string) {
    const status = this.integrationMonitoringService.getIntegrationStatus(serviceName);

    if (!status) {
      throw new NotFoundException(`Integration ${serviceName} not found`);
    }

    return status;
  }

  @Post('health/check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'moderator')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Выполнить ручную проверку здоровья интеграций' })
  @ApiResponse({ status: 200, description: 'Проверка выполнена' })
  async performManualHealthCheck() {
    const statuses = await this.integrationMonitoringService.performManualHealthCheck();
    const summary = this.integrationMonitoringService.getIntegrationSummary();

    return {
      message: 'Manual health check completed',
      summary,
      integrations: statuses,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Получить сводку по интеграциям' })
  @ApiResponse({ status: 200, description: 'Сводка интеграций' })
  async getIntegrationSummary() {
    return this.integrationMonitoringService.getIntegrationSummary();
  }
}
