import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';

describe('OrderController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    authToken = jwtService.sign({ sub: 'test-user-id', username: 'testuser' });
  });

  afterAll(async () => {
    await app.close();
  });

  let orderId: string;

  it('/orders (POST) -> should create a new order', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        gameId: 'game-123',
        gameName: 'Test E2E Game',
        amount: 500,
      })
      .expect(201)
      .then((response) => {
        expect(response.body.data.id).toBeDefined();
        orderId = response.body.data.id;
      });
  });

  it('/orders/:id (GET) -> should get a specific order', () => {
    return request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200)
      .then((response) => {
        expect(response.body.data.id).toEqual(orderId);
        expect(response.body.data.amount).toEqual(500);
      });
  });

  it('/orders (GET) -> should get a list of orders', () => {
    return request(app.getHttpServer())
      .get('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200)
      .then((response) => {
        expect(response.body.data.total).toBeGreaterThan(0);
        expect(response.body.data.data).toBeInstanceOf(Array);
      });
  });
});
