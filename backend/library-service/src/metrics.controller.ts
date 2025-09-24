import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { register } from 'prom-client';
import type { Response } from 'express';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  @Get()
  @ApiOperation({
    summary: 'Get Prometheus metrics',
    description: 'Returns Prometheus-formatted metrics for monitoring and alerting',
  })
  @ApiResponse({
    status: 200,
    description: 'Prometheus metrics retrieved successfully',
    content: {
      'text/plain': {
        schema: {
          type: 'string',
          example: `# HELP nodejs_version_info Node.js version info
# TYPE nodejs_version_info gauge
nodejs_version_info{version="v18.17.0",major="18",minor="17",patch="0"} 1

# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds.
# TYPE process_cpu_user_seconds_total counter
process_cpu_user_seconds_total 0.015625

# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/library/my",status_code="200"} 42`,
        },
      },
    },
  })
  async index(@Res() response: Response) {
    const metrics = await register.metrics();
    response.set('Content-Type', register.contentType);
    response.end(metrics);
  }
}
