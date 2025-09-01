import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { VerificationController } from '../../src/infrastructure/http/controllers/verification.controller';
import { VerificationService } from '../../src/application/services/verification.service';
import { SubmitVerificationDto } from '../../src/infrastructure/http/dtos/submit-verification.dto';
import { VerificationState } from '../../src/application/services/types/verification.types';

describe('VerificationController (e2e)', () => {
  let app: INestApplication;

  const mockVerificationService = {
    submitForVerification: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [VerificationController],
      providers: [
        {
          provide: VerificationService,
          useValue: mockVerificationService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Add validation pipe to test DTO validation
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/verification/submit (POST) - success', () => {
    const dto: SubmitVerificationDto = {
      userId: 'c6f7e3d8-9a0a-4b3e-8c3f-3e3e3e3e3e3e',
      profileType: 'developer',
      documents: [
        {
          type: 'passport',
          filePath: '/path/to/passport.pdf',
          uploadedAt: new Date(),
        },
      ],
    };

    mockVerificationService.submitForVerification.mockResolvedValue(VerificationState.APPROVED);

    return request(app.getHttpServer())
      .post('/verification/submit')
      .send(dto)
      .expect(201)
      .expect(res => {
        expect(mockVerificationService.submitForVerification).toHaveBeenCalledWith(
          dto.userId,
          dto.documents,
          dto.profileType,
        );
        expect(res.text).toBe(VerificationState.APPROVED);
      });
  });

  it('/verification/submit (POST) - validation error', () => {
    const invalidDto = {
      userId: 'not-a-uuid', // should fail validation, though we don't have IsUUID here
      profileType: 'invalid-type', // should fail enum validation
      documents: [],
    };

    return request(app.getHttpServer()).post('/verification/submit').send(invalidDto).expect(400); // Bad Request due to validation failure
  });
});
