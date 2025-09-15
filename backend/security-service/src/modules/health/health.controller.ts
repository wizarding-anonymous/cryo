import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get('ready')
  readiness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'security-service',
      check: 'ready',
    };
  }

  @Get('live')
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'security-service',
      check: 'live',
    };
  }
}

