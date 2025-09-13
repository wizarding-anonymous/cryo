import { Controller, Get, Res } from '@nestjs/common';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import { Response } from 'express';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly prometheusController: PrometheusController) {}

  @Get()
  async index(@Res() response: Response) {
    return this.prometheusController.index(response);
  }
}
