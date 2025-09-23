import { Controller, Get, Res } from '@nestjs/common';
import { register } from 'prom-client';
import type { Response } from 'express';

@Controller('metrics')
export class MetricsController {
  @Get()
  async index(@Res() response: Response) {
    const metrics = await register.metrics();
    response.set('Content-Type', register.contentType);
    response.end(metrics);
  }
}
