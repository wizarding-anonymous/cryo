export interface IntegrationHealth {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  responseTime?: number;
  errorRate?: number;
  details?: any;
}

export interface EventDeliveryMetrics {
  topic: string;
  successCount: number;
  failureCount: number;
  lastDelivery: Date;
  averageDeliveryTime: number;
}

export interface IntegrationDashboardData {
  healthChecks: IntegrationHealth[];
  eventMetrics: EventDeliveryMetrics[];
  summary: {
    totalIntegrations: number;
    healthyIntegrations: number;
    totalEvents: number;
    failedEvents: number;
  };
}