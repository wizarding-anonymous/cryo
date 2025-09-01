import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { BasicPublisherController } from '../../src/infrastructure/http/controllers/basic-publisher.controller';
import { BasicPublisherService } from '../../src/application/services/basic-publisher.service';

describe('BasicPublisherController (e2e)', () => {
  let app: INestApplication;

  const mockPublisherService = {
    getBasicProfileByUserId: jest.fn(() => Promise.resolve({ companyName: 'Test Publisher' })),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BasicPublisherController],
      providers: [
        {
          provide: BasicPublisherService,
          useValue: mockPublisherService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/publishers/:userId/basic-profile (GET)', () => {
    const userId = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';

    return request(app.getHttpServer())
      .get(`/publishers/${userId}/basic-profile`)
      .expect(200)
      .expect(res => {
        expect(mockPublisherService.getBasicProfileByUserId).toHaveBeenCalledWith(userId);
        expect(res.body.companyName).toEqual('Test Publisher');
      });
  });
});
