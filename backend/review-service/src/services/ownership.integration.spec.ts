import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { OwnershipService } from './ownership.service';

describe('OwnershipService Integration', () => {
  let service: OwnershipService;
  let httpService: HttpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        HttpModule.register({
          timeout: 5000,
          maxRedirects: 3,
        }),
        CacheModule.register({
          ttl: 600,
          max: 100,
        }),
      ],
      providers: [OwnershipService],
    }).compile();

    service = module.get<OwnershipService>(OwnershipService);
    httpService = module.get<HttpService>(HttpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(httpService).toBeDefined();
  });

  it('should have proper HttpModule configuration', () => {
    // Verify that HttpModule is properly configured
    expect(httpService).toBeInstanceOf(HttpService);
  });

  it('should handle service health check', async () => {
    const health = await service.getServiceHealth();
    
    expect(health).toHaveProperty('status');
    expect(health).toHaveProperty('libraryService');
    expect(['healthy', 'unhealthy']).toContain(health.status);
    expect(typeof health.libraryService).toBe('boolean');
  });
});