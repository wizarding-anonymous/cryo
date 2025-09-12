import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { CreateGameDto } from '../src/dto/create-game.dto';
import { UpdateGameDto } from '../src/dto/update-game.dto';

describe('GameController (e2e)', () => {
  let app: INestApplication;
  let createdGameId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const createGameDto: CreateGameDto = {
    title: 'E2E Test Game',
    price: 19.99,
    developer: 'E2E Studios',
    genre: 'Testing',
  };

  it('POST /api/games - should create a new game', () => {
    return request(app.getHttpServer())
      .post('/api/games')
      .send(createGameDto)
      .expect(201)
      .then((res) => {
        expect(res.body).toBeDefined();
        expect(res.body.id).toBeDefined();
        expect(res.body.title).toEqual(createGameDto.title);
        createdGameId = res.body.id;
      });
  });

  it('GET /api/games/:id - should get the created game', () => {
    return request(app.getHttpServer())
      .get(`/api/games/${createdGameId}`)
      .expect(200)
      .then((res) => {
        expect(res.body.id).toEqual(createdGameId);
        expect(res.body.title).toEqual(createGameDto.title);
      });
  });

  it('PATCH /api/games/:id - should update the game', () => {
    const updateGameDto: UpdateGameDto = { title: 'Updated E2E Test Game' };
    return request(app.getHttpServer())
      .patch(`/api/games/${createdGameId}`)
      .send(updateGameDto)
      .expect(200)
      .then((res) => {
        expect(res.body.title).toEqual(updateGameDto.title);
      });
  });

  it('GET /api/games/:id - should get the updated game', () => {
    return request(app.getHttpServer())
      .get(`/api/games/${createdGameId}`)
      .expect(200)
      .then((res) => {
        expect(res.body.title).toEqual('Updated E2E Test Game');
      });
  });

  it('DELETE /api/games/:id - should delete the game', () => {
    return request(app.getHttpServer())
      .delete(`/api/games/${createdGameId}`)
      .expect(200);
  });

  it('GET /api/games/:id - should return 404 for the deleted game', () => {
    return request(app.getHttpServer())
      .get(`/api/games/${createdGameId}`)
      .expect(404);
  });
});
