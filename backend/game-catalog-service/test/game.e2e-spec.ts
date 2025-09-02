import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GameService } from '../src/application/services/game.service';
import { Game } from '../src/domain/entities/game.entity';
import { CreateGameDto } from 'src/infrastructure/http/dtos/create-game.dto';

describe('GameController (e2e)', () => {
  let app: INestApplication;
  const mockGame = { id: 'some-uuid', title: 'Test Game', price: 10 } as Game;

  const mockGameService = {
    create: jest.fn().mockResolvedValue(mockGame),
    findAll: jest.fn().mockResolvedValue({ data: [mockGame], total: 1 }),
    findOne: jest.fn().mockResolvedValue(mockGame),
    update: jest.fn().mockResolvedValue(mockGame),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  // Mock JWT strategy to bypass actual authentication
  const mockJwtGuard = { canActivate: jest.fn(() => true) };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(GameService)
    .useValue(mockGameService)
    .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/games (POST) - should create a game', () => {
    const createGameDto: CreateGameDto = {
        title: 'Test Game',
        price: 10,
        developerId: 'dev-uuid',
        isFree: false
    };
    return request(app.getHttpServer())
      .post('/games')
      .set('Authorization', 'Bearer fake-token') // bypass guard
      .send(createGameDto)
      .expect(201)
      .expect(mockGame);
  });

  it('/games (POST) - should fail with bad request for invalid data', () => {
    return request(app.getHttpServer())
      .post('/games')
      .set('Authorization', 'Bearer fake-token')
      .send({ title: 'T' }) // title is too short
      .expect(400);
  });

  it('/games (GET)', () => {
    return request(app.getHttpServer())
      .get('/games')
      .expect(200)
      .expect(mockGameService.findAll());
  });

  it('/games/:id (GET)', () => {
    return request(app.getHttpServer())
      .get(`/games/${mockGame.id}`)
      .expect(200)
      .expect(mockGame);
  });

  it('/games/:id (PUT)', () => {
    return request(app.getHttpServer())
      .put(`/games/${mockGame.id}`)
      .set('Authorization', 'Bearer fake-token')
      .send({ title: 'Updated Title' })
      .expect(200)
      .expect(mockGame);
  });

  it('/games/:id (DELETE)', () => {
    return request(app.getHttpServer())
      .delete(`/games/${mockGame.id}`)
      .set('Authorization', 'Bearer fake-token')
      .expect(204);
  });
});
