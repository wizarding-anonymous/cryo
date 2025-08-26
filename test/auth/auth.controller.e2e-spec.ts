import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { UserService } from '../../src/application/services/user.service';
import { UserActivationService } from '../../src/application/services/user-activation.service';

describe('Auth Endpoints (e2e)', () => {
  let app: INestApplication;

  const mockUserService = {
    createUser: jest.fn(),
  };
  const mockActivationService = {
    activateUser: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(UserService)
    .useValue(mockUserService)
    .overrideProvider(UserActivationService)
    .useValue(mockActivationService)
    .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/users/register (POST) should call user service', () => {
    const dto = { email: 'e2e@test.com', username: 'e2e_user', password: 'Password123' };
    mockUserService.createUser.mockResolvedValue({ id: 'user-id' });

    return request(app.getHttpServer())
      .post('/users/register')
      .send(dto)
      .expect(201)
      .expect(res => {
        expect(mockUserService.createUser).toHaveBeenCalledWith(dto);
      });
  });

  it('/auth/activate (GET) should call activation service', () => {
    const token = 'my-activation-token';
    mockActivationService.activateUser.mockResolvedValue(undefined);

    return request(app.getHttpServer())
      .get(`/auth/activate?token=${token}`)
      .expect(200)
      .expect(res => {
        expect(mockActivationService.activateUser).toHaveBeenCalledWith(token);
        expect(res.body.message).toContain('activated');
      });
  });
});
