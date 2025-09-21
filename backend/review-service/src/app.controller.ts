import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get service info' })
  @ApiResponse({ status: 200, description: 'Service information' })
  getHello(): string {
    return this.appService.getHello();
  }

  // Health endpoint без префикса для совместимости с Docker healthcheck
  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint (legacy)' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  getHealth() {
    return this.appService.getHealth();
  }
}
