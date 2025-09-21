import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from '../app.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        service: { type: 'string', example: 'review-service' },
        version: { type: 'string', example: '1.0.0' },
        environment: { type: 'string', example: 'development' }
      }
    }
  })
  getHealth() {
    return this.appService.getHealth();
  }
}