import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Post, Body } from '@nestjs/common';
import { GlobalValidationPipe } from './global-validation.pipe';
import { IsString, IsEmail } from 'class-validator';
import request from 'supertest';

class TestRequestDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;
}

@Controller('test')
class TestController {
  @Post()
  create(@Body() dto: TestRequestDto) {
    return { success: true, data: dto };
  }
}

describe('Validation Integration', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestController],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new GlobalValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should accept valid request data', async () => {
    const validData = {
      name: 'John Doe',
      email: 'john@example.com',
    };

    const response = await request(app.getHttpServer())
      .post('/test')
      .send(validData)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('John Doe');
    expect(response.body.data.email).toBe('john@example.com');
  });

  it('should reject invalid request data', async () => {
    const invalidData = {
      name: null, // Should be string
      email: 'invalid-email', // Should be valid email
    };

    const response = await request(app.getHttpServer())
      .post('/test')
      .send(invalidData)
      .expect(400);

    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.message).toBe('Request validation failed');
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'name',
          constraint: 'isString',
        }),
        expect.objectContaining({
          field: 'email',
          constraint: 'isEmail',
        }),
      ]),
    );
  });

  it('should reject non-whitelisted properties', async () => {
    const dataWithExtraProps = {
      name: 'John Doe',
      email: 'john@example.com',
      extraProp: 'should be rejected',
    };

    await request(app.getHttpServer())
      .post('/test')
      .send(dataWithExtraProps)
      .expect(400);
  });

  it('should transform data types when possible', async () => {
    const dataWithTransformation = {
      name: 'John Doe',
      email: 'john@example.com',
    };

    const response = await request(app.getHttpServer())
      .post('/test')
      .send(dataWithTransformation)
      .expect(201);

    expect(typeof response.body.data.name).toBe('string');
    expect(typeof response.body.data.email).toBe('string');
  });
});
