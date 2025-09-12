import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { GameCatalogIntegrationService } from '../../integrations/game-catalog/game-catalog.service';
import { LibraryIntegrationService } from '../../integrations/library/library.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private gameCatalogService: GameCatalogIntegrationService,
    private libraryService: LibraryIntegrationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Check service health' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  @HealthCheck()
  check() {
    return this.health.check([
      // Database health check
      () => this.db.pingCheck('database'),
      
      // Memory health check (should not exceed 150MB)
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      
      // Storage health check (should not exceed 90% of disk)
      () => this.disk.checkStorage('storage', { 
        path: '/', 
        thresholdPercent: 0.9 
      }),
      () => this.gameCatalogService.checkHealth().then(result => ({ 'game-catalog-service': { status: result.status } })),
      () => this.libraryService.checkHealth().then(result => ({ 'library-service': { status: result.status } })),
    ]);
  }

  @Get('ready')
  @ApiOperation({ summary: 'Check if service is ready to accept requests' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }

  @Get('live')
  @ApiOperation({ summary: 'Check if service is alive' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'payment-service',
      version: '1.0.0',
    };
  }
}