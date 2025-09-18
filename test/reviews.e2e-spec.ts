import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { OwnershipService } from '../src/reviews/ownership.service';
import { CreateReviewDto } from '../src/reviews/dto/review.dto';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Review } from '../src/entities/review.entity';
import { Repository } from 'typeorm';

describe('ReviewsController (e2e)', () => {
  let app: INestApplication;
  let reviewRepository: Repository<Review>;

  // Mock OwnershipService to avoid real HTTP calls during tests
  const mockOwnershipService = {
    checkGameOwnership: jest.fn().mockResolvedValue(true),
  };

  const reviewDto: CreateReviewDto = {
    gameId: 'c1b4a44a-0a6b-4e1d-8a4a-4a4a4a4a4a4a',
    text: 'This is an e2e test review.',
    rating: 5,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(OwnershipService)
    .useValue(mockOwnershipService)
    .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    reviewRepository = moduleFixture.get<Repository<Review>>(getRepositoryToken(Review));
    // Clean up database before tests
    await reviewRepository.query('DELETE FROM reviews;');
    await reviewRepository.query('DELETE FROM game_ratings;');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/reviews (POST)', () => {
    it('should create a review successfully', () => {
      return request(app.getHttpServer())
        .post('/reviews')
        .send(reviewDto)
        .expect(201)
        .then(response => {
          expect(response.body).toEqual(
            expect.objectContaining({
              text: reviewDto.text,
              rating: reviewDto.rating,
              gameId: reviewDto.gameId,
            }),
          );
        });
    });

    it('should fail if user does not own the game', () => {
        mockOwnershipService.checkGameOwnership.mockResolvedValueOnce(false);
        return request(app.getHttpServer())
            .post('/reviews')
            .send(reviewDto)
            .expect(403);
    });

    it('should fail if a review already exists for that game and user', () => {
        // The first request should succeed
        return request(app.getHttpServer())
            .post('/reviews')
            .send(reviewDto)
            .expect(201)
            .then(() => {
                // The second request should fail
                return request(app.getHttpServer())
                    .post('/reviews')
                    .send(reviewDto)
                    .expect(409);
            });
    });
  });

  // More e2e tests for GET, PUT, DELETE would go here
});
