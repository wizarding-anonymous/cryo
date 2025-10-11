import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Root')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Get service information',
    description: `
      Returns basic information about the Auth Service.
      
      **Information Provided:**
      - Service name and version
      - Welcome message
      - Basic service status
      
      **Use Cases:**
      - Service discovery
      - Version verification
      - Basic connectivity test
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Auth Service information and welcome message',
    schema: {
      type: 'string',
      example: '🔐 Auth Service v1.0 - Authentication and Authorization Microservice for Russian Gaming Platform'
    }
  })
  getHello(): string {
    return this.appService.getHello();
  }
}