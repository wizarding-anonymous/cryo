import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { BasicDeveloperController } from '../../src/infrastructure/http/controllers/basic-developer.controller';
import { BasicDeveloperService } from '../../src/application/services/basic-developer.service';
import { CreateDeveloperProfileDto } from '../../src/application/services/dtos/create-developer-profile.dto';

describe('BasicDeveloperController (e2e)', () => {
  let app: INestApplication;

  const mockDeveloperService = {
    createBasicDeveloperProfile: jest.fn(),
    getBasicProfileByUserId: jest.fn(),
    // ... other methods
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BasicDeveloperController],
      providers: [
        {
          provide: BasicDeveloperService,
          useValue: mockDeveloperService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/developers (POST)', () => {
    const dto: CreateDeveloperProfileDto = {
      userId: 'c6f7e3d8-9a0a-4b3e-8c3f-3e3e3e3e3e3e',
      companyName: 'Test Corp',
      companyType: 'llc',
      contactEmail: 'test@corp.com',
      inn: '1234567890',
    };

    mockDeveloperService.createBasicDeveloperProfile.mockResolvedValue({ id: 'some-id', ...dto });

    return request(app.getHttpServer())
      .post('/developers')
      .send(dto)
      .expect(201)
      .expect(res => {
        expect(res.body.id).toBe('some-id');
        expect(res.body.companyName).toBe('Test Corp');
      });
  });

  it('/developers/:userId/basic-profile (GET)', () => {
    const userId = 'c6f7e3d8-9a0a-4b3e-8c3f-3e3e3e3e3e3e';
    const profile = { userId, companyName: 'Test Corp' };

    mockDeveloperService.getBasicProfileByUserId.mockResolvedValue(profile);

    return request(app.getHttpServer())
      .get(`/developers/${userId}/basic-profile`)
      .expect(200)
      .expect(res => {
        expect(res.body.companyName).toEqual('Test Corp');
      });
  });
});
