import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { SystemMetricsService } from './system-metrics.service';
import { MetricsService } from './metrics.service';

describe('SystemMetricsService', () => {
  let service: SystemMetricsService;
  let metricsService: jest.Mocked<MetricsService>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    const mockMetricsService = {
      updateSystemMetrics: jest.fn(),
    };

    const mockDataSource = {
      isInitialized: true,
      driver: {
        master: {
          totalCount: 10,
        },
      },
      options: {
        extra: {
          max: 15,
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemMetricsService,
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<SystemMetricsService>(SystemMetricsService);
    metricsService = module.get(MetricsService);
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize service', async () => {
      await service.onModuleInit();

      // Just verify it doesn't throw
      expect(service).toBeDefined();
    });
  });

  describe('connection management', () => {
    it('should increment active connections', async () => {
      const initialSnapshot = await service.getSystemMetricsSnapshot();
      const initialConnections = initialSnapshot.activeConnections;

      service.incrementActiveConnections();

      const updatedSnapshot = await service.getSystemMetricsSnapshot();
      expect(updatedSnapshot.activeConnections).toBe(initialConnections + 1);
    });

    it('should decrement active connections', async () => {
      service.incrementActiveConnections();
      service.incrementActiveConnections();
      const snapshotAfterIncrement = await service.getSystemMetricsSnapshot();
      const connectionsAfterIncrement =
        snapshotAfterIncrement.activeConnections;

      service.decrementActiveConnections();

      const finalSnapshot = await service.getSystemMetricsSnapshot();
      expect(finalSnapshot.activeConnections).toBe(
        connectionsAfterIncrement - 1,
      );
    });

    it('should not go below zero when decrementing', async () => {
      service.decrementActiveConnections();

      const snapshot = await service.getSystemMetricsSnapshot();
      expect(snapshot.activeConnections).toBe(0);
    });
  });

  describe('getSystemMetricsSnapshot', () => {
    it('should return complete system metrics snapshot', async () => {
      const snapshot = await service.getSystemMetricsSnapshot();

      expect(snapshot).toHaveProperty('activeConnections');
      expect(snapshot).toHaveProperty('memoryUsage');
      expect(snapshot).toHaveProperty('databasePoolSize');
      expect(snapshot).toHaveProperty('uptime');
      expect(snapshot).toHaveProperty('nodeVersion');
      expect(snapshot).toHaveProperty('platform');

      expect(typeof snapshot.activeConnections).toBe('number');
      expect(typeof snapshot.memoryUsage).toBe('number');
      expect(typeof snapshot.databasePoolSize).toBe('number');
      expect(typeof snapshot.uptime).toBe('number');
      expect(typeof snapshot.nodeVersion).toBe('string');
      expect(typeof snapshot.platform).toBe('string');
    });
  });

  describe('getMemoryUsageBreakdown', () => {
    it('should return memory usage breakdown', () => {
      const breakdown = service.getMemoryUsageBreakdown();

      expect(breakdown).toHaveProperty('rss');
      expect(breakdown).toHaveProperty('heapTotal');
      expect(breakdown).toHaveProperty('heapUsed');
      expect(breakdown).toHaveProperty('external');
      expect(breakdown).toHaveProperty('arrayBuffers');

      expect(typeof breakdown.rss).toBe('number');
      expect(typeof breakdown.heapTotal).toBe('number');
      expect(typeof breakdown.heapUsed).toBe('number');
      expect(typeof breakdown.external).toBe('number');
      expect(typeof breakdown.arrayBuffers).toBe('number');
    });
  });

  describe('getCpuUsage', () => {
    it('should return CPU usage', () => {
      const cpuUsage = service.getCpuUsage();

      expect(cpuUsage).toHaveProperty('user');
      expect(cpuUsage).toHaveProperty('system');

      expect(typeof cpuUsage.user).toBe('number');
      expect(typeof cpuUsage.system).toBe('number');
    });
  });

  describe('database pool size detection', () => {
    it('should get pool size from driver master pool', async () => {
      const snapshot = await service.getSystemMetricsSnapshot();

      expect(snapshot.databasePoolSize).toBe(10);
    });

    it('should return 0 when driver info unavailable', async () => {
      // Mock dataSource with no driver info
      (dataSource as any).driver = {};
      (dataSource as any).options = {};

      const snapshot = await service.getSystemMetricsSnapshot();

      expect(snapshot.databasePoolSize).toBe(0);
    });

    it('should return 0 when database is not initialized', async () => {
      const mockDataSourceNotInit = {
        isInitialized: false,
        driver: dataSource.driver,
      };

      const serviceNotInit = new (service.constructor as any)(
        mockDataSourceNotInit,
        metricsService,
      );

      const snapshot = await serviceNotInit.getSystemMetricsSnapshot();

      expect(snapshot.databasePoolSize).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      // Mock dataSource that throws error
      (dataSource as any).isInitialized = true;
      (dataSource as any).driver = null;
      (dataSource as any).options = {};

      const snapshot = await service.getSystemMetricsSnapshot();

      expect(snapshot.databasePoolSize).toBe(0);
    });
  });
});
