import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ProfileService } from '../../src/application/services/profile.service';
import { RoleService } from '../../src/application/services/role.service';
import { JwtAuthGuard } from '../../src/infrastructure/auth/guards/jwt-auth.guard';

describe('Feature Controllers (e2e)', () => {
  let app: INestApplication;

  const mockProfileService = {
    updatePrivacySettings: jest.fn(),
  };
  const mockRoleService = {
    getAllRoles: jest.fn(),
  };
  const mockUser = { userId: 'test-user-id' };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ProfileService)
      .useValue(mockProfileService)
      .overrideProvider(RoleService)
      .useValue(mockRoleService)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: context => {
          const req = context.switchToHttp().getRequest();
          req.user = mockUser; // Attach mock user to request
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/profile/settings/privacy (PUT) should call profile service', () => {
    const settings = { showEmail: false };
    mockProfileService.updatePrivacySettings.mockResolvedValue(undefined);

    return request(app.getHttpServer())
      .put('/profile/settings/privacy')
      .send(settings)
      .expect(200)
      .expect(res => {
        expect(mockProfileService.updatePrivacySettings).toHaveBeenCalledWith(mockUser.userId, settings);
      });
  });

  it('/admin/roles (GET) should call role service', () => {
    mockRoleService.getAllRoles.mockResolvedValue([{ name: 'admin' }]);

    return request(app.getHttpServer())
      .get('/admin/roles')
      .expect(200)
      .expect(res => {
        expect(mockRoleService.getAllRoles).toHaveBeenCalled();
        expect(res.body[0].name).toBe('admin');
      });
  });
});
