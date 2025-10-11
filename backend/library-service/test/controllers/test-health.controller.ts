import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class TestHealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'library-service',
    };
  }

  @Get('detailed')
  getDetailedHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'library-service',
      info: {
        database: { status: 'up' },
        redis: { status: 'up' },
      },
    };
  }
}