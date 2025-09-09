import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { CreateGameDto } from '../src/infrastructure/http/dtos/create-game.dto';
import { Game } from '../src/domain/entities/game.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('GreenlightIntegrationController (e2e)', () => {
  let app: INestApplication;
  let gameRepository: Repository<Game>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    gameRepository = moduleFixture.get<Repository<Game>>(getRepositoryToken(Game));
  });

  afterAll(async () => {
    // Clean up the created game
    const game = await gameRepository.findOne({ where: { title: 'Approved Greenlight Game' } });
    if (game) {
      await gameRepository.delete(game.id);
    }
    await app.close();
  });

  it('/integration/greenlight/approve-game (POST) should create a new game', async () => {
    const createGameDto: CreateGameDto = {
      title: 'Approved Greenlight Game',
      description: 'A game approved by the community.',
      developerId: 'de7b8d37-5f72-451e-a496-151852825b30', // Mock developer UUID
      publisherId: 'de7b8d37-5f72-451e-a496-151852825b30', // Mock publisher UUID
      price: 29.99,
      isFree: false,
      releaseDate: new Date(),
    };

    const response = await request(app.getHttpServer())
      .post('/integration/greenlight/approve-game')
      .send(createGameDto)
      .expect(201);

    expect(response.body).toBeDefined();
    expect(response.body.title).toEqual(createGameDto.title);
    expect(response.body.id).toBeDefined();

    // Verify it was actually saved in the database
    const savedGame = await gameRepository.findOne({ where: { id: response.body.id } });
    expect(savedGame).toBeDefined();
    expect(savedGame.title).toEqual(createGameDto.title);
  });

  it('/integration/greenlight/approve-game (POST) should fail with bad data', async () => {
    const badDto = {
      // Missing title and other required fields
      description: 'This is a bad request.',
    };

    await request(app.getHttpServer())
      .post('/integration/greenlight/approve-game')
      .send(badDto)
      .expect(400);
  });
});
