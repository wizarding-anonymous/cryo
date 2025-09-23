import { registerAs } from '@nestjs/config';
import type { ServiceConfig } from './service-config.interface';

export type ServicesConfig = Record<string, ServiceConfig>;

export default registerAs('services', (): ServicesConfig => {
  const defaultTimeout = Number(process.env.SERVICE_DEFAULT_TIMEOUT_MS ?? 5000);
  const defaultRetries = Number(process.env.SERVICE_DEFAULT_RETRIES ?? 1);

  const build = (name: string, baseUrl: string, healthCheckPath = '/health'): ServiceConfig => ({
    name,
    baseUrl,
    timeout: defaultTimeout,
    retries: defaultRetries,
    healthCheckPath,
  });

  return {
    'user-service': build('user-service', process.env.SERVICE_USER_BASE_URL ?? 'http://localhost:3000'),
    'game-catalog-service': build(
      'game-catalog-service',
      process.env.SERVICE_GAME_CATALOG_BASE_URL ?? 'http://localhost:3002',
    ),
    'payment-service': build('payment-service', process.env.SERVICE_PAYMENT_BASE_URL ?? 'http://localhost:3003'),
    'library-service': build('library-service', process.env.SERVICE_LIBRARY_BASE_URL ?? 'http://localhost:3004'),
    'notification-service': build(
      'notification-service',
      process.env.SERVICE_NOTIFICATION_BASE_URL ?? 'http://localhost:3005',
    ),
    'review-service': build('review-service', process.env.SERVICE_REVIEW_BASE_URL ?? 'http://localhost:3006'),
    'achievement-service': build(
      'achievement-service',
      process.env.SERVICE_ACHIEVEMENT_BASE_URL ?? 'http://localhost:3007',
    ),
    'security-service': build('security-service', process.env.SERVICE_SECURITY_BASE_URL ?? 'http://localhost:3008'),
    'social-service': build('social-service', process.env.SERVICE_SOCIAL_BASE_URL ?? 'http://localhost:3009'),
    'download-service': build('download-service', process.env.SERVICE_DOWNLOAD_BASE_URL ?? 'http://localhost:3010'),
    'api-gateway': build('api-gateway', `http://localhost:${process.env.PORT ?? 3001}`, '/api/health'),
  };
});

