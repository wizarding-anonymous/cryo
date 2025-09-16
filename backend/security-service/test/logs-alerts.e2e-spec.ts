import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AdminGuard } from '../src/common/guards/admin.guard';
import { SecurityAlertSeverity } from '../src/common/enums/security-alert-severity.enum';
import { SecurityAlertType } from '../src/common/enums/security-alert-type.enum';
import { SecurityEventType } from '../src/common/enums/security-event-type.enum';
import { AlertsService } from '../src/modules/alerts/alerts.service';
import { LoggingService } from '../src/modules/logs/logging.service';
import { KAFKA_PRODUCER_SERVICE } from '../src/kafka/kafka.constants';
import { ClientKafka } from '@nestjs/microservices';

describe('Logs/Alerts (e2e)', () => {
  let app: INestApplication;
  let alertsService: AlertsService;
  let kafkaClient: ClientKafka;
  let kafkaEmitSpy: jest.SpyInstance;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(AdminGuard).useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    alertsService = app.get(AlertsService);
    kafkaClient = app.get<ClientKafka>(KAFKA_PRODUCER_SERVICE);
    kafkaEmitSpy = jest.spyOn(kafkaClient, 'emit').mockImplementation();
  });

  afterAll(async () => {
    kafkaEmitSpy.mockRestore();
    await app.close();
  });

  it('GET /security/logs returns paginated logs', async () => {
    // First, create a log event to ensure there's data
    const loggingService = app.get(LoggingService);
    await loggingService.logSecurityEvent({
      type: SecurityEventType.OTHER,
      ip: '1.2.3.4',
      data: { info: 'test-log' },
    });

    const res = await request(app.getHttpServer())
      .get('/security/logs')
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it('POST a critical alert should trigger a Kafka event', async () => {
    const alertDto = {
      type: SecurityAlertType.SUSPICIOUS_ACTIVITY,
      severity: SecurityAlertSeverity.CRITICAL,
      userId: '33333333-3333-3333-3333-333333333333',
      data: { source: 'e2e-test' },
    };

    await alertsService.createAlert(alertDto);

    expect(kafkaEmitSpy).toHaveBeenCalled();
    expect(kafkaEmitSpy).toHaveBeenCalledWith('security.alerts.created', expect.objectContaining({
      severity: SecurityAlertSeverity.CRITICAL,
      userId: alertDto.userId,
    }));
  });
});
