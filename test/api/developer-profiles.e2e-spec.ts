import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { BasicDeveloperService } from '../../src/application/services/basic-developer.service';

// This is a partial E2E test that mocks the service layer,
// as we cannot connect to a real database in this environment.
describe('Developer Profiles API (e2e)', () => {
  let app: INestApplication;
  let developerService: BasicDeveloperService;

  const mockDeveloperService = {
    getBasicProfileByUserId: jest.fn(),
    // We would mock other methods here as well
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(BasicDeveloperService)
    .useValue(mockDeveloperService)
    .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    developerService = moduleFixture.get<BasicDeveloperService>(BasicDeveloperService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /developers/:userId/basic-profile should return profile', async () => {
    const userId = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
    const profile = { userId, companyName: 'Mock Studio' };
    mockDeveloperService.getBasicProfileByUserId.mockResolvedValue(profile as any);

    const response = await request(app.getHttpServer())
      .get(`/developers/${userId}/basic-profile`)
      .expect(200);

    expect(response.body.companyName).toEqual('Mock Studio');
  });

  it('GET /developers/:userId/verification-status should return status', async () => {
    const userId = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
    const profile = { verificationStatus: 'approved', isVerified: true };
    // This endpoint is on the same controller but we can mock the service method it calls
    mockDeveloperService.getBasicProfileByUserId.mockResolvedValue(profile as any);

    const response = await request(app.getHttpServer())
      .get(`/developers/${userId}/verification-status`)
      .expect(200);

    expect(response.body.status).toMatch(/approved/);
  });
});
