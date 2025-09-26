import { HttpMethod } from '../common/enums/http-method.enum';
import { ServiceName } from '../common/enums/service-name.enum';
import { RateLimitConfig } from '../common/interfaces/rate-limit-config.interface';

export interface RouteConfig {
  path: string;
  method: HttpMethod;
  service: ServiceName;
  requiresAuth: boolean;
  rateLimit?: RateLimitConfig;
  timeout?: number;
}
