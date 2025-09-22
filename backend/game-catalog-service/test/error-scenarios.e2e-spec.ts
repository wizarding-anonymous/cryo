import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupTestDatabase, cleanupTestDatabase } from './setup-e2e';

describe('Error Scenarios and Edge Cases (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await setupTestDatabase();

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
    await cleanupTestDatabase();
  });

  describe('Input Validation Errors', () => {
    describe('Game Creation Validation', () => {
      it('should reject empty title', async () => {
        const invalidData = {
          title: '',
          price: 29.99,
          developer: 'Test Studio',
          genre: 'Test',
        };

        await request(app.getHttpServer())
          .post('/api/games')
          .send(invalidData)
          .expect(400)
          .expect((res) => {
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toContain('title');
          });
      });

      it('should reject whitespace-only title', async () => {
        const invalidData = {
          title: '   ',
          price: 29.99,
          developer: 'Test Studio',
          genre: 'Test',
        };

        await request(app.getHttpServer())
          .post('/api/games')
          .send(invalidData)
          .expect(400)
          .expect((res) => {
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
          });
      });

      it('should reject negative price', async () => {
        const invalidData = {
          title: 'Test Game',
          price: -10.99,
          developer: 'Test Studio',
          genre: 'Test',
        };

        await request(app.getHttpServer())
          .post('/api/games')
          .send(invalidData)
          .expect(400)
          .expect((res) => {
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toContain('price');
          });
      });

      it('should reject invalid price type', async () => {
        const invalidData = {
          title: 'Test Game',
          price: 'not-a-number',
          developer: 'Test Studio',
          genre: 'Test',
        };

        await request(app.getHttpServer())
          .post('/api/games')
          .send(invalidData)
          .expect(400)
          .expect((res) => {
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
          });
      });

      it('should reject excessively long title', async () => {
        const invalidData = {
          title: 'A'.repeat(256), // Assuming 255 is the limit
          price: 29.99,
          developer: 'Test Studio',
          genre: 'Test',
        };

        await request(app.getHttpServer())
          .post('/api/games')
          .send(invalidData)
          .expect(400)
          .expect((res) => {
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
          });
      });

      it('should reject invalid currency code', async () => {
        const invalidData = {
          title: 'Test Game',
          price: 29.99,
          currency: 'INVALID',
          developer: 'Test Studio',
          genre: 'Test',
        };

        await request(app.getHttpServer())
          .post('/api/games')
          .send(invalidData)
          .expect(400)
          .expect((res) => {
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
          });
      });

      it('should reject invalid date format', async () => {
        const invalidData = {
          title: 'Test Game',
          price: 29.99,
          developer: 'Test Studio',
          genre: 'Test',
          releaseDate: 'not-a-date',
        };

        await request(app.getHttpServer())
          .post('/api/games')
          .send(invalidData)
          .expect(400)
          .expect((res) => {
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
          });
      });

      it('should reject invalid system requirements format', async () => {
        const invalidData = {
          title: 'Test Game',
          price: 29.99,
          developer: 'Test Studio',
          genre: 'Test',
          systemRequirements: 'not-an-object',
        };

        await request(app.getHttpServer())
          .post('/api/games')
          .send(invalidData)
          .expect(400)
          .expect((res) => {
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
          });
      });

      it('should reject non-array images field', async () => {
        const invalidData = {
          title: 'Test Game',
          price: 29.99,
          developer: 'Test Studio',
          genre: 'Test',
          images: 'not-an-array',
        };

        await request(app.getHttpServer())
          .post('/api/games')
          .send(invalidData)
          .expect(400)
          .expect((res) => {
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
          });
      });

      it('should reject additional unknown fields', async () => {
        const invalidData = {
          title: 'Test Game',
          price: 29.99,
          developer: 'Test Studio',
          genre: 'Test',
          unknownField: 'should be rejected',
        };

        await request(app.getHttpServer())
          .post('/api/games')
          .send(invalidData)
          .expect(400)
          .expect((res) => {
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
          });
      });
    });

    describe('Game Update Validation', () => {
      let testGameId: string;

      beforeAll(async () => {
        const gameData = {
          title: 'Update Test Game',
          price: 29.99,
          developer: 'Test Studio',
          genre: 'Test',
        };

        const response = await request(app.getHttpServer())
          .post('/api/games')
          .send(gameData)
          .expect(201);

        testGameId = response.body.id;
      });

      afterAll(async () => {
        await request(app.getHttpServer())
          .delete(`/api/games/${testGameId}`)
          .expect(204);
      });

      it('should reject empty title in update', async () => {
        const updateData = { title: '' };

        await request(app.getHttpServer())
          .patch(`/api/games/${testGameId}`)
          .send(updateData)
          .expect(400)
          .expect((res) => {
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
          });
      });

      it('should reject negative price in update', async () => {
        const updateData = { price: -5.99 };

        await request(app.getHttpServer())
          .patch(`/api/games/${testGameId}`)
          .send(updateData)
          .expect(400)
          .expect((res) => {
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
          });
      });

      it('should reject unknown fields in update', async () => {
        const updateData = { 
          title: 'Updated Title',
          unknownField: 'should be rejected'
        };

        await request(app.getHttpServer())
          .patch(`/api/games/${testGameId}`)
          .send(updateData)
          .expect(400)
          .expect((res) => {
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
          });
      });
    });

    describe('Search Parameter Validation', () => {
      it('should reject invalid search type', async () => {
        await request(app.getHttpServer())
          .get('/api/games/search')
          .query({ searchType: 'invalid' })
          .expect(400)
          .expect((res) => {
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
          });
      });

      it('should reject invalid price range (min > max)', async () => {
        await request(app.getHttpServer())
          .get('/api/games/search')
          .query({ minPrice: 100, maxPrice: 50 })
          .expect(400)
          .expect((res) => {
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
          });
      });

      it('should reject negative prices in search', async () => {
        await request(app.getHttpServer())
          .get('/api/games/search')
          .query({ minPrice: -10 })
          .expect(400)
          .expect((res) => {
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
          });
      });

      it('should reject invalid pagination parameters', async () => {
        await request(app.getHttpServer())
          .get('/api/games/search')
          .query({ page: 0, limit: 101 })
          .expect(400)
          .expect((res) => {
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
          });
      });

      it('should reject non-numeric pagination parameters', async () => {
        await request(app.getHttpServer())
          .get('/api/games/search')
          .query({ page: 'not-a-number', limit: 'also-not-a-number' })
          .expect(400)
          .expect((res) => {
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
          });
      });

      it('should handle empty search query gracefully', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/games/search')
          .query({ q: '' })
          .expect(200);

        expect(response.body.games).toBeDefined();
        expect(Array.isArray(response.body.games)).toBe(true);
      });

      it('should handle whitespace-only search query', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/games/search')
          .query({ q: '   ' })
          .expect(200);

        expect(response.body.games).toBeDefined();
        expect(Array.isArray(response.body.games)).toBe(true);
      });
    });
  });

  describe('Resource Not Found Errors', () => {
    it('should return 404 for non-existent game ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .get(`/api/games/${nonExistentId}`)
        .expect(404)
        .expect((res) => {
          expect(res.body.error.code).toBe('GAME_NOT_FOUND');
          expect(res.body.error.message).toContain('not found');
        });
    });

    it('should return 404 for purchase info of non-existent game', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .get(`/api/games/${nonExistentId}/purchase-info`)
        .expect(404)
        .expect((res) => {
          expect(res.body.error.code).toBe('GAME_NOT_FOUND');
        });
    });

    it('should return 404 when updating non-existent game', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const updateData = { title: 'Updated Title' };

      await request(app.getHttpServer())
        .patch(`/api/games/${nonExistentId}`)
        .send(updateData)
        .expect(404)
        .expect((res) => {
          expect(res.body.error.code).toBe('GAME_NOT_FOUND');
        });
    });

    it('should return 404 when deleting non-existent game', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .delete(`/api/games/${nonExistentId}`)
        .expect(404)
        .expect((res) => {
          expect(res.body.error.code).toBe('GAME_NOT_FOUND');
        });
    });

    it('should handle malformed UUID gracefully', async () => {
      const malformedId = 'not-a-valid-uuid';

      await request(app.getHttpServer())
        .get(`/api/games/${malformedId}`)
        .expect(400)
        .expect((res) => {
          expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });
  });

  describe('HTTP Method Errors', () => {
    it('should return 405 for unsupported methods on game endpoints', async () => {
      await request(app.getHttpServer())
        .put('/api/games')
        .expect(405);
    });

    it('should return 405 for unsupported methods on specific game endpoints', async () => {
      const gameId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .post(`/api/games/${gameId}`)
        .expect(405);
    });

    it('should return 405 for unsupported methods on search endpoints', async () => {
      await request(app.getHttpServer())
        .post('/api/games/search')
        .expect(405);
    });
  });

  describe('Content Type and Format Errors', () => {
    it('should reject non-JSON content type for POST requests', async () => {
      await request(app.getHttpServer())
        .post('/api/games')
        .set('Content-Type', 'text/plain')
        .send('not json')
        .expect(400);
    });

    it('should reject malformed JSON', async () => {
      await request(app.getHttpServer())
        .post('/api/games')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);
    });

    it('should handle empty request body for POST', async () => {
      await request(app.getHttpServer())
        .post('/api/games')
        .send({})
        .expect(400)
        .expect((res) => {
          expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    it('should handle null request body for POST', async () => {
      await request(app.getHttpServer())
        .post('/api/games')
        .send(null)
        .expect(400);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    describe('Pagination Edge Cases', () => {
      it('should handle page beyond available results', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/games')
          .query({ page: 9999, limit: 10 })
          .expect(200);

        expect(response.body.games).toBeDefined();
        expect(response.body.games).toHaveLength(0);
        expect(response.body.page).toBe(9999);
        expect(response.body.hasNext).toBe(false);
      });

      it('should handle maximum limit value', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/games')
          .query({ page: 1, limit: 100 })
          .expect(200);

        expect(response.body.games).toBeDefined();
        expect(response.body.games.length).toBeLessThanOrEqual(100);
        expect(response.body.limit).toBe(100);
      });

      it('should handle minimum valid pagination values', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/games')
          .query({ page: 1, limit: 1 })
          .expect(200);

        expect(response.body.games).toBeDefined();
        expect(response.body.games.length).toBeLessThanOrEqual(1);
        expect(response.body.page).toBe(1);
        expect(response.body.limit).toBe(1);
      });
    });

    describe('Search Edge Cases', () => {
      it('should handle very long search queries', async () => {
        const longQuery = 'a'.repeat(1000);

        const response = await request(app.getHttpServer())
          .get('/api/games/search')
          .query({ q: longQuery })
          .expect(200);

        expect(response.body.games).toBeDefined();
        expect(Array.isArray(response.body.games)).toBe(true);
      });

      it('should handle special characters in search', async () => {
        const specialQuery = '!@#$%^&*()_+-=[]{}|;:,.<>?';

        const response = await request(app.getHttpServer())
          .get('/api/games/search')
          .query({ q: specialQuery })
          .expect(200);

        expect(response.body.games).toBeDefined();
        expect(Array.isArray(response.body.games)).toBe(true);
      });

      it('should handle Unicode characters in search', async () => {
        const unicodeQuery = '测试游戏 тест игра';

        const response = await request(app.getHttpServer())
          .get('/api/games/search')
          .query({ q: unicodeQuery })
          .expect(200);

        expect(response.body.games).toBeDefined();
        expect(Array.isArray(response.body.games)).toBe(true);
      });

      it('should handle SQL injection attempts in search', async () => {
        const sqlInjectionQuery = "'; DROP TABLE games; --";

        const response = await request(app.getHttpServer())
          .get('/api/games/search')
          .query({ q: sqlInjectionQuery })
          .expect(200);

        expect(response.body.games).toBeDefined();
        expect(Array.isArray(response.body.games)).toBe(true);
      });

      it('should handle extreme price ranges', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/games/search')
          .query({ minPrice: 0, maxPrice: 999999.99 })
          .expect(200);

        expect(response.body.games).toBeDefined();
        expect(Array.isArray(response.body.games)).toBe(true);
      });
    });

    describe('Data Boundary Conditions', () => {
      let boundaryTestGameId: string;

      beforeAll(async () => {
        // Create a game with boundary values
        const boundaryGameData = {
          title: 'B', // Minimum length title
          price: 0.01, // Minimum price
          developer: 'D', // Minimum length developer
          genre: 'G', // Minimum length genre
        };

        const response = await request(app.getHttpServer())
          .post('/api/games')
          .send(boundaryGameData)
          .expect(201);

        boundaryTestGameId = response.body.id;
      });

      afterAll(async () => {
        await request(app.getHttpServer())
          .delete(`/api/games/${boundaryTestGameId}`)
          .expect(204);
      });

      it('should handle minimum valid values', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/games/${boundaryTestGameId}`)
          .expect(200);

        expect(response.body.title).toBe('B');
        expect(response.body.price).toBe(0.01);
        expect(response.body.developer).toBe('D');
        expect(response.body.genre).toBe('G');
      });

      it('should handle maximum price precision', async () => {
        const updateData = { price: 999999.99 };

        const response = await request(app.getHttpServer())
          .patch(`/api/games/${boundaryTestGameId}`)
          .send(updateData)
          .expect(200);

        expect(response.body.price).toBe(999999.99);
      });

      it('should handle zero price', async () => {
        const updateData = { price: 0 };

        const response = await request(app.getHttpServer())
          .patch(`/api/games/${boundaryTestGameId}`)
          .send(updateData)
          .expect(200);

        expect(response.body.price).toBe(0);
      });
    });
  });

  describe('Concurrent Request Handling', () => {
    let concurrentTestGameId: string;

    beforeAll(async () => {
      const gameData = {
        title: 'Concurrent Test Game',
        price: 29.99,
        developer: 'Concurrent Studio',
        genre: 'Test',
      };

      const response = await request(app.getHttpServer())
        .post('/api/games')
        .send(gameData)
        .expect(201);

      concurrentTestGameId = response.body.id;
    });

    afterAll(async () => {
      await request(app.getHttpServer())
        .delete(`/api/games/${concurrentTestGameId}`)
        .expect(204);
    });

    it('should handle multiple concurrent read requests', async () => {
      const concurrentReads = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .get(`/api/games/${concurrentTestGameId}`)
          .expect(200)
      );

      const responses = await Promise.all(concurrentReads);
      
      responses.forEach(response => {
        expect(response.body.id).toBe(concurrentTestGameId);
        expect(response.body.title).toBe('Concurrent Test Game');
      });
    });

    it('should handle concurrent update requests gracefully', async () => {
      const concurrentUpdates = Array.from({ length: 5 }, (_, i) =>
        request(app.getHttpServer())
          .patch(`/api/games/${concurrentTestGameId}`)
          .send({ title: `Updated Title ${i}` })
      );

      const responses = await Promise.allSettled(concurrentUpdates);
      
      // At least one update should succeed
      const successfulUpdates = responses.filter(
        result => result.status === 'fulfilled' && result.value.status === 200
      );
      expect(successfulUpdates.length).toBeGreaterThan(0);
    });

    it('should handle mixed concurrent operations', async () => {
      const mixedOperations = [
        request(app.getHttpServer()).get(`/api/games/${concurrentTestGameId}`),
        request(app.getHttpServer()).get(`/api/games/${concurrentTestGameId}/purchase-info`),
        request(app.getHttpServer()).patch(`/api/games/${concurrentTestGameId}`).send({ price: 39.99 }),
        request(app.getHttpServer()).get('/api/games').query({ page: 1, limit: 5 }),
        request(app.getHttpServer()).get('/api/games/search').query({ q: 'Concurrent' }),
      ];

      const responses = await Promise.allSettled(mixedOperations);
      
      // Most operations should succeed
      const successfulOperations = responses.filter(
        result => result.status === 'fulfilled' && 
        [200, 201].includes(result.value.status)
      );
      expect(successfulOperations.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Rate Limiting and Performance', () => {
    it('should handle rapid sequential requests', async () => {
      const rapidRequests = [];
      
      for (let i = 0; i < 20; i++) {
        rapidRequests.push(
          request(app.getHttpServer())
            .get('/api/games')
            .query({ page: 1, limit: 5 })
        );
      }

      const responses = await Promise.all(rapidRequests);
      
      // All requests should complete successfully
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status); // 200 OK or 429 Too Many Requests
      });
    });

    it('should maintain response time under load', async () => {
      const startTime = Date.now();
      
      const loadRequests = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .get('/api/games')
          .query({ page: 1, limit: 10 })
          .expect(200)
      );

      await Promise.all(loadRequests);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // All requests should complete within reasonable time
      expect(totalTime).toBeLessThan(5000); // 5 seconds for 10 concurrent requests
    });
  });
});