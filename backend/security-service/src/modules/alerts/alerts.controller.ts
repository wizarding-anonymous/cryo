import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { GetAlertsQueryDto } from './dto/get-alerts-query.dto';
import { PaginatedSecurityAlerts } from '../../dto/responses/paginated-security-alerts.dto';
import { SecurityAlert } from '../../entities/security-alert.entity';
import { AdminGuard } from '../../common/guards/admin.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Security Alerts')
@Controller('security/alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Получить алерты безопасности (фильтруемые)' })
  getSecurityAlerts(@Query() query: GetAlertsQueryDto): Promise<PaginatedSecurityAlerts> {
    return this.alerts.getAlerts(query);
  }

  @Get('active')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Получить активные алерты' })
  getActive(): Promise<SecurityAlert[]> {
    return this.alerts.getActiveAlerts();
  }

  @Put(':id/resolve')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Отметить алерт как разрешенный' })
  async resolveAlert(@Param('id') id: string): Promise<void> {
    await this.alerts.resolveAlert(id);
  }
}
