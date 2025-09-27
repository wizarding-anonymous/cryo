export interface HealthCheckResult {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  services: ServiceHealthStatus[];
}

export interface ServiceHealthStatus {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime?: number;
  lastCheck: string;
  error?: string;
}
