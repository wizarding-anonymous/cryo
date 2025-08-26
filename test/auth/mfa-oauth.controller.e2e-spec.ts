import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { MfaService } from '../../src/application/services/mfa.service';
import { MockOAuthService } from '../../src/application/services/mock-oauth.service';
import { JwtAuthGuard } from '../../src/infrastructure/auth/guards/jwt-auth.guard';

describe('MFA and OAuth Endpoints (e2e)', () => {
  let app: INestApplication;

  const mockMfaService = {
    enableMfa: jest.fn(),
  };
  const mockOAuthService = {
    authenticate: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(MfaService)
    .useValue(mockMfaService)
    .overrideProvider(MockOAuthService)
    .useValue(mockOAuthService)
    .overrideGuard(JwtAuthGuard) // Mock the guard to allow access
    .useValue({ canActivate: () => true })
    .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/auth/mfa/enable (POST) should call mfa service', () => {
    mockMfaService.enableMfa.mockResolvedValue({ secret: '123' });

    return request(app.getHttpServer())
      .post('/auth/mfa/enable')
      .expect(201) // Changed to 201 for POST
      .expect(res => {
        expect(mockMfaService.enableMfa).toHaveBeenCalled();
      });
  });

  it('/auth/oauth/vk/callback (POST) should call oauth service', () => {
    mockOAuthService.authenticate.mockResolvedValue({ email: 'test@vk.com' });

    // In a real test, we would also mock the authService that is called next

    return request(app.getHttpServer())
      .post('/auth/oauth/vk/callback')
      .send({ code: 'mock_code' })
      .expect(201);
  });
});
