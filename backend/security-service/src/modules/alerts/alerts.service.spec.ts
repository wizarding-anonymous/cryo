import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AlertsService } from './alerts.service';
import { SecurityAlert } from '../../entities/security-alert.entity';
import { SecurityEvent } from '../../entities/security-event.entity';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { KAFKA_PRODUCER_SERVICE } from '../../kafka/kafka.constants';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { MetricsService } from '../../common/metrics/metrics.service';

const alertRepoMock = () => ({
  create: jest.fn((x) => ({ id: 'a1', createdAt: new Date(), ...x })),
  save: jest.fn(async (x) => x),
  find: jest.fn(async () => [{ id: 'a1', resolved: false }]),
  findOne: jest.fn(async () => ({ id: 'a1', resolved: false })),
  createQueryBuilder: jest.fn(() => {
    const qb: any = {
      andWhere: jest.fn(() => qb),
      orderBy: jest.fn(() => qb),
      skip: jest.fn(() => qb),
      take: jest.fn(() => qb),
      getManyAndCount: jest.fn(async () => [[{ id: 'a1' }], 1]),
    };
    return qb;
  }),
});

const eventsRepoMock = () => ({
  createQueryBuilder: jest.fn(() => {
    const qb: any = {
      where: jest.fn(() => qb),
      andWhere: jest.fn(() => qb),
      orderBy: jest.fn(() => qb),
      getMany: jest.fn(async () => [
        { id: 'e1', riskScore: 90, createdAt: new Date() },
        { id: 'e2', riskScore: 10, createdAt: new Date() },
      ]),
    };
    return qb;
  }),
});

describe('AlertsService', () => {
  let service: AlertsService;
  let alertsRepo: ReturnType<typeof alertRepoMock>;

  beforeEach(async () => {
    alertsRepo = alertRepoMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: getRepositoryToken(SecurityAlert), useValue: alertsRepo },
        { provide: getRepositoryToken(SecurityEvent), useValue: eventsRepoMock() },
        { provide: ConfigService, useValue: { get: (_: string, d?: any) => d } },
        { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: { info: jest.fn(), warn: jest.fn(), log: jest.fn() } },
        { provide: KAFKA_PRODUCER_SERVICE, useValue: { emit: jest.fn() } },
        { provide: EncryptionService, useValue: { encrypt: (d: any) => JSON.stringify(d), decrypt: (d: any) => JSON.parse(d || '{}') } },
        { provide: MetricsService, useValue: { recordAlert: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(AlertsService);
  });

  it('creates and resolves alert', async () => {
    const created = await service.createAlert({ type: 'OTHER' as any, severity: 'LOW' as any });
    expect(created).toBeDefined();
    await service.resolveAlert('a1');
    expect(alertsRepo.save).toHaveBeenCalled();
  });

  it('detects suspicious activity', async () => {
    const res = await service.detectSuspiciousActivity('u1');
    expect(typeof res.suspicious).toBe('boolean');
    expect(res.score).toBeGreaterThanOrEqual(0);
  });

  it('returns paginated alerts', async () => {
    const res = await service.getAlerts({ page: 1, pageSize: 10 });
    expect(res.total).toBe(1);
  });
});

