import { ApiProperty } from '@nestjs/swagger';

export class HealthIndicatorDto {
  @ApiProperty({
    example: 'up',
    description: 'Health status indicator',
    enum: ['up', 'down'],
  })
  status: 'up' | 'down';

  @ApiProperty({
    example: { message: 'Connection established' },
    description: 'Additional health information',
    required: false,
  })
  info?: Record<string, any>;
}

export class HealthCheckResponseDto {
  @ApiProperty({
    example: 'ok',
    description: 'Overall health status',
    enum: ['ok', 'error', 'shutting_down'],
  })
  status: 'ok' | 'error' | 'shutting_down';

  @ApiProperty({
    example: {
      database: { status: 'up' },
      memory_heap: { status: 'up' },
      memory_rss: { status: 'up' }
    },
    description: 'Individual health indicators',
    additionalProperties: { $ref: '#/components/schemas/HealthIndicatorDto' },
  })
  info: Record<string, HealthIndicatorDto>;

  @ApiProperty({
    example: null,
    description: 'Error information if health check failed',
    required: false,
  })
  error?: Record<string, HealthIndicatorDto>;

  @ApiProperty({
    example: {
      database: { status: 'up' },
      memory_heap: { status: 'up' },
      memory_rss: { status: 'up' }
    },
    description: 'Detailed health information',
  })
  details: Record<string, HealthIndicatorDto>;
}

export class ReadinessResponseDto {
  @ApiProperty({
    example: 'ready',
    description: 'Service readiness status',
  })
  status: string;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Timestamp of the readiness check',
  })
  timestamp: string;
}

export class LivenessResponseDto {
  @ApiProperty({
    example: 'alive',
    description: 'Service liveness status',
  })
  status: string;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Timestamp of the liveness check',
  })
  timestamp: string;
}

export class DatabaseInfoDto {
  @ApiProperty({
    example: 'PostgreSQL',
    description: 'Database type',
  })
  type: string;

  @ApiProperty({
    example: '15.4',
    description: 'Database version',
  })
  version: string;

  @ApiProperty({
    example: 'auth_db',
    description: 'Database name',
  })
  database: string;

  @ApiProperty({
    example: 'localhost:5432',
    description: 'Database host and port',
  })
  host: string;

  @ApiProperty({
    example: 10,
    description: 'Number of active connections',
  })
  activeConnections: number;

  @ApiProperty({
    example: 20,
    description: 'Maximum allowed connections',
  })
  maxConnections: number;
}

export class MigrationStatusDto {
  @ApiProperty({
    example: true,
    description: 'Whether all migrations are up to date',
  })
  upToDate: boolean;

  @ApiProperty({
    example: 5,
    description: 'Number of executed migrations',
  })
  executedMigrations: number;

  @ApiProperty({
    example: 0,
    description: 'Number of pending migrations',
  })
  pendingMigrations: number;

  @ApiProperty({
    example: ['CreateUserTable1640995200000', 'CreateSessionTable1640995300000'],
    description: 'List of executed migration names',
  })
  executedMigrationNames: string[];
}

export class DatabaseHealthResponseDto {
  @ApiProperty({
    example: true,
    description: 'Database connection status',
  })
  connected: boolean;

  @ApiProperty({
    example: 45.2,
    description: 'Database response time in milliseconds',
  })
  responseTime: number;

  @ApiProperty({
    type: MigrationStatusDto,
    description: 'Database migration status',
  })
  migrations: MigrationStatusDto;

  @ApiProperty({
    type: DatabaseInfoDto,
    description: 'Database connection information',
  })
  info: DatabaseInfoDto;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Timestamp of the health check',
  })
  timestamp: string;
}

export class DatabaseStatisticsDto {
  @ApiProperty({
    example: 1500,
    description: 'Total number of sessions',
  })
  totalSessions: number;

  @ApiProperty({
    example: 1200,
    description: 'Number of active sessions',
  })
  activeSessions: number;

  @ApiProperty({
    example: 300,
    description: 'Number of expired sessions',
  })
  expiredSessions: number;

  @ApiProperty({
    example: 450,
    description: 'Number of blacklisted tokens',
  })
  blacklistedTokens: number;

  @ApiProperty({
    example: 2500,
    description: 'Total number of login attempts',
  })
  totalLoginAttempts: number;

  @ApiProperty({
    example: 150,
    description: 'Number of failed login attempts',
  })
  failedLoginAttempts: number;

  @ApiProperty({
    example: 75,
    description: 'Number of security events',
  })
  securityEvents: number;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Statistics collection timestamp',
  })
  timestamp: string;
}

export class MaintenanceTaskDto {
  @ApiProperty({
    example: 'cleanup_expired_sessions',
    description: 'Maintenance task name',
  })
  task: string;

  @ApiProperty({
    example: 'completed',
    description: 'Task execution status',
    enum: ['completed', 'failed', 'skipped'],
  })
  status: 'completed' | 'failed' | 'skipped';

  @ApiProperty({
    example: 25,
    description: 'Number of records affected',
  })
  recordsAffected: number;

  @ApiProperty({
    example: 1250.5,
    description: 'Task execution time in milliseconds',
  })
  executionTime: number;

  @ApiProperty({
    example: 'Cleaned up 25 expired sessions',
    description: 'Task result message',
  })
  message: string;
}

export class DatabaseMaintenanceResponseDto {
  @ApiProperty({
    example: 'success',
    description: 'Overall maintenance status',
  })
  status: string;

  @ApiProperty({
    type: [MaintenanceTaskDto],
    description: 'List of executed maintenance tasks',
  })
  maintenance: MaintenanceTaskDto[];

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Maintenance execution timestamp',
  })
  timestamp: string;
}

export class CircuitBreakerStatsDto {
  @ApiProperty({
    example: 'user-service',
    description: 'Circuit breaker name',
  })
  name: string;

  @ApiProperty({
    example: 'CLOSED',
    description: 'Circuit breaker state',
    enum: ['CLOSED', 'OPEN', 'HALF_OPEN'],
  })
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';

  @ApiProperty({
    example: 1250,
    description: 'Total number of requests',
  })
  totalRequests: number;

  @ApiProperty({
    example: 1200,
    description: 'Number of successful requests',
  })
  successfulRequests: number;

  @ApiProperty({
    example: 50,
    description: 'Number of failed requests',
  })
  failedRequests: number;

  @ApiProperty({
    example: 4.0,
    description: 'Failure rate percentage',
  })
  failureRate: number;

  @ApiProperty({
    example: 125.5,
    description: 'Average response time in milliseconds',
  })
  averageResponseTime: number;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Statistics timestamp',
  })
  timestamp: string;
}

export class CircuitBreakersResponseDto {
  @ApiProperty({
    example: 'success',
    description: 'Response status',
  })
  status: string;

  @ApiProperty({
    example: {
      count: 3,
      names: ['user-service', 'security-service', 'notification-service'],
      statistics: {}
    },
    description: 'Circuit breaker information',
  })
  circuitBreakers: {
    count: number;
    names: string[];
    statistics: Record<string, CircuitBreakerStatsDto>;
  };

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Response timestamp',
  })
  timestamp: string;
}

export class RedisHealthResponseDto {
  @ApiProperty({
    example: true,
    description: 'Redis connection status',
  })
  connected: boolean;

  @ApiProperty({
    example: 45.2,
    description: 'Redis response time in milliseconds',
    nullable: true,
  })
  responseTime: number | null;

  @ApiProperty({
    example: 'healthy',
    description: 'Overall Redis health status',
    enum: ['healthy', 'unhealthy'],
  })
  status: 'healthy' | 'unhealthy';

  @ApiProperty({
    example: 'Connection failed',
    description: 'Error message if Redis is unhealthy',
    required: false,
  })
  error?: string;

  @ApiProperty({
    example: {
      basicOperations: true,
      tokenBlacklist: true
    },
    description: 'Redis feature availability',
  })
  features: {
    basicOperations: boolean;
    tokenBlacklist: boolean;
  };

  @ApiProperty({
    example: {
      pingResponseTime: 45.2,
      connectionStatus: 'active'
    },
    description: 'Redis performance metrics',
  })
  performance: {
    pingResponseTime: number | null;
    connectionStatus: 'active' | 'failed';
  };

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Health check timestamp',
  })
  timestamp: string;
}