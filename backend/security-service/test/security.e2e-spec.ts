import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityEvent } from '../src/entities/security-event.entity';
import { SecurityEventType } from '../src/common/enums/security-event-type.enum';

describe('SecurityController (Integration)', () => {
  let app: INestApplication;
  let eventRepository: Repository<SecurityEvent>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    
    // Apply the same configuration as main app
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    
    await app.init();

    eventRepository = app.get<Repository<SecurityEvent>>(
      getRepositoryToken(SecurityEvent),
    );
  }, 30000); // Increase timeout to 30 seconds

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // Clean up the table before each test
  beforeEach(async () => {
    await eventRepository.clear();
  });

  it('/security/report-event (POST) should create a security event in the database', async () => {
    const dto = {
      type: SecurityEventType.OTHER,
      ip: '1.2.3.4',
      userId: '22222222-2222-2222-2222-222222222222',
      data: { test: 'data' },
    };

    // Act: send the request
    await request(app.getHttpServer())
      .post('/security/report-event')
      .send(dto)
      .expect(204);

    // Assert: check the database
    const events = await eventRepository.find();
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.type).toBe(dto.type);
    expect(event.ip).toBe(dto.ip);
    expect(event.userId).toBe(dto.userId);
    expect(event.data).toEqual(dto.data);
  });
});
