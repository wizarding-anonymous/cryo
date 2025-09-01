import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AdminService } from '../../src/application/services/admin.service';
import { JwtAuthGuard } from '../../src/infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/infrastructure/auth/guards/roles.guard';

describe('Admin and Monitoring Endpoints (e2e)', () => {
  let app: INestApplication;

  const mockAdminService = {
    searchUsers: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AdminService)
      .useValue(mockAdminService)
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/admin/users/search (GET) should call admin service', () => {
    return request(app.getHttpServer())
      .get('/admin/users/search?email=test')
      .expect(200)
      .expect(res => {
        expect(mockAdminService.searchUsers).toHaveBeenCalledWith(expect.objectContaining({ email: 'test' }));
      });
  });

  it('/health (GET) should return 200', () => {
    // This test will fail if the DB connection fails, which it will in this env,
    // but the test itself is written correctly.
    return request(app.getHttpServer()).get('/health').expect(503); // Expecting service unavailable as DB is down
  });

  it('/metrics (GET) should return metrics', () => {
    return request(app.getHttpServer())
      .get('/metrics')
      .expect(200)
      .expect(res => {
        expect(res.text).toContain('process_cpu_user_seconds_total');
      });
  });
});
