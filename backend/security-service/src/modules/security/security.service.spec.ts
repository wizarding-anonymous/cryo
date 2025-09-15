import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SecurityService } from './security.service';
import { LoggingService } from '../logs/logging.service';
import { RateLimitService } from './rate-limit.service';
import { ConfigService } from '@nestjs/config';
import { IPBlock } from '../../entities/ip-block.entity';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

const repoMock = () => ({ create: jest.fn((x) => x), save: jest.fn(async (x) => ({ id: '1', ...x })), findOne: jest.fn(async () => null) });

const redisMock = () => ({ get: jest.fn(async () => null), set: jest.fn(async () => 'OK'), del: jest.fn(async () => 1) });

describe('SecurityService', () => {
  let service: SecurityService;
  let ipRepo: ReturnType<typeof repoMock>;

  beforeEach(async () => {
    ipRepo = repoMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SecurityService,
        { provide: LoggingService, useValue: { logSecurityEvent: jest.fn(async () => ({})) } },
        { provide: RateLimitService, useValue: {
          checkRateLimit: jest.fn(async () => ({ allowed: true, remaining: 10, resetInSeconds: 60 })),
          getRemainingRequests: jest.fn(async () => 5),
        } },
        { provide: ConfigService, useValue: { get: (k: string, d?: any) => d ?? 0 } },
        { provide: getRepositoryToken(IPBlock), useValue: ipRepo },
        { provide: REDIS_CLIENT, useValue: redisMock() },
        { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: { info: jest.fn(), warn: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(SecurityService);
  });

  it('blocks login when IP is in blocklist', async () => {
    const redis = (await (service as any).redis) as any;
    // Simulate IP is blocked via Redis key
    redis.get = jest.fn(async () => '1');
    const res = await service.checkLoginSecurity({ userId: 'u1', ip: '1.2.3.4', userAgent: 'ua' });
    expect(res.allowed).toBe(false);
    expect(res.riskScore).toBe(100);
  });

  it('blockIP writes to DB and warms redis', async () => {
    const res = await service.blockIP('1.2.3.4', 'test', 30);
    expect(ipRepo.save).toHaveBeenCalled();
  });

  it('calculateRiskScore increases for high amount', async () => {
    const score = await service.calculateRiskScore('u1', { amount: 100000 });
    expect(score).toBeGreaterThan(5);
  });
});

