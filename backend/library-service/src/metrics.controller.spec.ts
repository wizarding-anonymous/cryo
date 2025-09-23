import type { Response } from 'express';
import { MetricsController } from './metrics.controller';
import { register } from 'prom-client';

jest.mock('prom-client', () => ({
  register: {
    metrics: jest.fn().mockResolvedValue('metrics-data'),
    contentType: 'text/plain',
  },
}));

describe('MetricsController', () => {
  it('writes metrics to the response', async () => {
    const controller = new MetricsController();
    const response = {
      set: jest.fn(),
      end: jest.fn(),
    } as unknown as Response;

    await controller.index(response);

    expect(register.metrics).toHaveBeenCalled();
    expect(response.set).toHaveBeenCalledWith('Content-Type', 'text/plain');
    expect(response.end).toHaveBeenCalledWith('metrics-data');
  });
});
