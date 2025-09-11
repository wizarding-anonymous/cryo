import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'user_service_',
        },
      },
    }),
  ],
  exports: [PrometheusModule],
})
export class AppPrometheusModule {}
