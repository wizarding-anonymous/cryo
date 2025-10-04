import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Game } from '../src/entities/game.entity';
import { CacheService } from '../src/common/services/cache.service';
import { CreateGameDto } from '../src/dto/create-game.dto';
import { UpdateGameDto } from '../src/dto/update-game.dto';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';

describe('Application Integration (e2e)', () => {
  let app: INestApplication;
  let gameRepository: jest.Mocked<Repository<Game>>;
  let cacheService: jest.Mocked<CacheService>;

  // Mock data
  const mockGame: Game = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Integration Test Game',
    description: 'A comprehensive test game for integration testing',
    shortDescription: 'Integration test game',
    price: 39.99,
    currency: 'RUB',
    genre: 'Action',
    developer: 'Integration Studio',
    publisher: 'Integration Publisher',
    releaseDate: new Date('2023-01-01'),
    images: ['integration1.jpg', 'integration2.jpg'],
    systemRequirements: {
      minimum: 'Minimum system requirements',
      recommended: 'Recommended system requirements',
    },
    available: true,
    createdAt: new Date('2025-10-04T01:33:26.329Z'),
    updatedAt: new Date('2025-10-04T01:33:26.329Z'),
  };

  const mockGames: Game[] = [
    mockGame,
    {
      ...mockGame,
      id: '123e4567-e89b-12d3-a456-426614174001',
      title: 'RPG Adventure Game',
      genre: 'RPG',
      price: 49.99,
      updatedAt: new Date('2025-10-04T01:33:26.329Z'),
    },
    {
      ...mockGame,
      id: '123e4567-e89b-12d3-a456-426614174002',
      title: 'Strategy Master',
      genre: 'Strategy',
      price: 29.99,
      updatedAt: new Date('2025-10-04T01:33:26.329Z'),
    },
  ];

  beforeAll(async () => {
    // Create mocks
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      findAndCount: jest.fn(),
      preload: jest.fn(),
      delete: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockCacheService = {
      invalidateGameCache: jest.fn(),
    };

    const mockQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };

    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getRepositoryToken(Game))
      .useValue(mockRepository)
      .overrideProvider(CacheService)
      .useValue(mockCacheService)
      .compile();

    app = moduleFixture.createNestApplication();

    // Apply the same configuration as main.ts
    const httpAdapterHost = app.get(HttpAdapterHost);
    app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost));
    
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

    gameRepository = moduleFixture.get(getRepositoryToken(Game));
    cacheService = moduleFixture.get(CacheService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Game CRUD Operations', () => {
    describe('POST /api/games', () => {
      it('should create a new game', async () => {
        const createGameDto: CreateGameDto = {
          title: 'New Test Game',
          description: 'A new game for testing',
          price: 59.99,
          genre: 'Adventure',
          developer: 'Test Studio',
          publisher: 'Test Publisher',
        };

        const createdGame = { 
          ...mockGame, 
          ...createGameDto, 
          releaseDate: new Date(mockGame.releaseDate),
          systemRequirements: mockGame.systemRequirements
        };
        gameRepository.create.mockReturnValue(createdGame);
        gameRepository.save.mockResolvedValue(createdGame);

        const response = await request(app.getHttpServer())
          .post('/api/games')
          .send(createGameDto)
          .expect(201);

        expect(response.body.title).toBe(createGameDto.title);
        expect(response.body.price).toBe(createGameDto.price);
        expect(gameRepository.create).toHaveBeenCalledWith(expect.objectContaining({
          title: createGameDto.title,
          description: createGameDto.description,
          price: createGameDto.price,
          genre: createGameDto.genre,
          developer: createGameDto.developer,
          publisher: createGameDto.publisher,
        }));
        expect(gameRepository.save).toHaveBeenCalled();
        expect(cacheService.invalidateGameCache).toHaveBeenCalled();
      });

      it('should validate required fields', async () => {
        const invalidGameDto = {
          title: '', // Empty title
          price: -10, // Negative price
        };

        await request(app.getHttpServer())
          .post('/api/games')
          .send(invalidGameDto)
          .expect(400)
          .expect((res) => {
            expect(res.body.error).toBeDefined();
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
          });

        expect(gameRepository.save).not.toHaveBeenCalled();
      });

      it('should reject unknown fields', async () => {
        const invalidGameDto = {
          title: 'Valid Game',
          price: 29.99,
          unknownField: 'should be rejected',
        };

        await request(app.getHttpServer())
          .post('/api/games')
          .send(invalidGameDto)
          .expect(400);

        expect(gameRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('GET /api/games', () => {
      it('should return paginated games', async () => {
        gameRepository.findAndCount.mockResolvedValue([
          mockGames,
          mockGames.length,
        ]);

        const response = await request(app.getHttpServer())
          .get('/api/games')
          .query({ page: 1, limit: 10 })
          .expect(200);

        expect(response.body.games).toBeDefined();
        expect(response.body.total).toBe(mockGames.length);
        expect(response.body.page).toBe(1);
        expect(response.body.limit).toBe(10);
        expect(response.body.hasNext).toBe(false);

        expect(gameRepository.findAndCount).toHaveBeenCalledWith({
          where: { available: true },
          take: 10,
          skip: 0,
          order: { releaseDate: 'DESC' },
        });
      });

      it('should apply genre filter', async () => {
        const rpgGames = mockGames.filter((game: Game) => game.genre === 'RPG');
        gameRepository.findAndCount.mockResolvedValue([
          rpgGames,
          rpgGames.length,
        ]);

        const response = await request(app.getHttpServer())
          .get('/api/games')
          .query({ genre: 'RPG' })
          .expect(200);

        expect(response.body.games).toHaveLength(rpgGames.length);
        expect(gameRepository.findAndCount).toHaveBeenCalledWith({
          where: { available: true, genre: 'RPG' },
          take: 10,
          skip: 0,
          order: { releaseDate: 'DESC' },
        });
      });

      it('should validate pagination parameters', async () => {
        await request(app.getHttpServer())
          .get('/api/games')
          .query({ page: 0, limit: 101 })
          .expect(400);

        expect(gameRepository.findAndCount).not.toHaveBeenCalled();
      });
    });

    describe('GET /api/games/:id', () => {
      it('should return game by id', async () => {
        gameRepository.findOneBy.mockResolvedValue(mockGame);

        const response = await request(app.getHttpServer())
          .get(`/api/games/${mockGame.id}`)
          .expect(200);

        expect(response.body.id).toBe(mockGame.id);
        expect(response.body.title).toBe(mockGame.title);
        expect(gameRepository.findOneBy).toHaveBeenCalledWith(
          expect.objectContaining({
            id: mockGame.id,
            available: true,
          })
        );
      });

      it('should return 404 for non-existent game', async () => {
        gameRepository.findOneBy.mockResolvedValue(null);

        await request(app.getHttpServer())
          .get('/api/games/00000000-0000-0000-0000-000000000000')
          .expect(404)
          .expect((res) => {
            expect(res.body.error).toBeDefined();
            expect(res.body.error.code).toBe('NOT_FOUND');
          });
      });

      it('should validate UUID format', async () => {
        await request(app.getHttpServer())
          .get('/api/games/invalid-uuid')
          .expect(400)
          .expect((res) => {
            expect(res.body.error).toBeDefined();
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
          });
      });
    });

    describe('PATCH /api/games/:id', () => {
      it('should update existing game', async () => {
        const updateDto: UpdateGameDto = {
          title: 'Updated Game Title',
          price: 69.99,
        };

        const updatedGame = { 
          ...mockGame, 
          ...updateDto, 
          releaseDate: new Date(mockGame.releaseDate),
          systemRequirements: mockGame.systemRequirements
        };
        gameRepository.preload.mockResolvedValue(updatedGame);
        gameRepository.save.mockResolvedValue(updatedGame);

        const response = await request(app.getHttpServer())
          .patch(`/api/games/${mockGame.id}`)
          .send(updateDto)
          .expect(200);

        expect(response.body.title).toBe(updateDto.title);
        expect(response.body.price).toBe(updateDto.price);
        expect(gameRepository.preload).toHaveBeenCalledWith(expect.objectContaining({
          id: mockGame.id,
          title: updateDto.title,
          price: updateDto.price,
        }));
        expect(cacheService.invalidateGameCache).toHaveBeenCalledWith(
          mockGame.id,
        );
      });

      it('should return 404 for non-existent game', async () => {
        gameRepository.preload.mockResolvedValue(null);

        await request(app.getHttpServer())
          .patch('/api/games/00000000-0000-0000-0000-000000000000')
          .send({ title: 'Updated Title' })
          .expect(404);

        expect(gameRepository.save).not.toHaveBeenCalled();
      });

      it('should validate update data', async () => {
        await request(app.getHttpServer())
          .patch(`/api/games/${mockGame.id}`)
          .send({ price: -10 })
          .expect(400);

        expect(gameRepository.preload).not.toHaveBeenCalled();
      });
    });

    describe('DELETE /api/games/:id', () => {
      it('should delete existing game', async () => {
        gameRepository.delete.mockResolvedValue({ affected: 1, raw: {} });

        await request(app.getHttpServer())
          .delete(`/api/games/${mockGame.id}`)
          .expect(204);

        expect(gameRepository.delete).toHaveBeenCalledWith(mockGame.id);
        expect(cacheService.invalidateGameCache).toHaveBeenCalledWith(
          mockGame.id,
        );
      });

      it('should return 404 for non-existent game', async () => {
        gameRepository.delete.mockResolvedValue({ affected: 0, raw: {} });

        await request(app.getHttpServer())
          .delete('/api/games/00000000-0000-0000-0000-000000000000')
          .expect(404);
      });
    });

    describe('GET /api/games/:id/purchase-info', () => {
      it('should return purchase information', async () => {
        gameRepository.findOneBy.mockResolvedValue(mockGame);

        const response = await request(app.getHttpServer())
          .get(`/api/games/${mockGame.id}/purchase-info`)
          .expect(200);

        expect(response.body.id).toBe(mockGame.id);
        expect(response.body.title).toBe(mockGame.title);
        expect(response.body.price).toBe(mockGame.price);
        expect(response.body.currency).toBe(mockGame.currency);
        expect(response.body.available).toBe(mockGame.available);
      });

      it('should return 404 for unavailable game', async () => {
        gameRepository.findOneBy.mockResolvedValue(null);

        await request(app.getHttpServer())
          .get('/api/games/00000000-0000-0000-0000-000000000000/purchase-info')
          .expect(404);
      });
    });
  });

  describe('Game Search Operations', () => {
    const mockQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };

    beforeEach(() => {
      gameRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );
      jest.clearAllMocks();
    });

    describe('GET /api/games/search', () => {
      it('should search games by title', async () => {
        const searchResults = [mockGame];
        mockQueryBuilder.getManyAndCount.mockResolvedValue([searchResults, 1]);

        const response = await request(app.getHttpServer())
          .get('/api/games/search')
          .query({ q: 'Integration', searchType: 'title' })
          .expect(200);

        expect(response.body.games).toHaveLength(1);
        expect(response.body.total).toBe(1);
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
          "to_tsvector('russian', game.title) @@ to_tsquery('russian', :query)",
          { query: 'Integration:*' },
        );
      });

      it('should search games by description', async () => {
        mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

        await request(app.getHttpServer())
          .get('/api/games/search')
          .query({ q: 'comprehensive', searchType: 'description' })
          .expect(200);

        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
          "to_tsvector('russian', COALESCE(game.description, '')) @@ to_tsquery('russian', :query)",
          { query: 'comprehensive:*' },
        );
      });

      it('should search across all fields', async () => {
        mockQueryBuilder.getManyAndCount.mockResolvedValue([
          mockGames,
          mockGames.length,
        ]);

        const response = await request(app.getHttpServer())
          .get('/api/games/search')
          .query({ q: 'test', searchType: 'all' })
          .expect(200);

        expect(response.body.games).toHaveLength(mockGames.length);
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
          "to_tsvector('russian', game.title || ' ' || COALESCE(game.description, '') || ' ' || COALESCE(game.shortDescription, '') || ' ' || COALESCE(game.developer, '') || ' ' || COALESCE(game.publisher, '')) @@ to_tsquery('russian', :query)",
          { query: 'test:*' },
        );
      });

      it('should filter by price range', async () => {
        const filteredGames = mockGames.filter(
          (game: Game) => game.price >= 30 && game.price <= 50,
        );
        mockQueryBuilder.getManyAndCount.mockResolvedValue([
          filteredGames,
          filteredGames.length,
        ]);

        const response = await request(app.getHttpServer())
          .get('/api/games/search')
          .query({ minPrice: 30, maxPrice: 50 })
          .expect(200);

        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
          'game.price >= :minPrice',
          { minPrice: 30 },
        );
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
          'game.price <= :maxPrice',
          { maxPrice: 50 },
        );
      });

      it('should combine search query with price filters', async () => {
        mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

        await request(app.getHttpServer())
          .get('/api/games/search')
          .query({
            q: 'adventure',
            minPrice: 20,
            maxPrice: 60,
            searchType: 'all',
          })
          .expect(200);

        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
          "to_tsvector('russian', game.title || ' ' || COALESCE(game.description, '') || ' ' || COALESCE(game.shortDescription, '') || ' ' || COALESCE(game.developer, '') || ' ' || COALESCE(game.publisher, '')) @@ to_tsquery('russian', :query)",
          { query: 'adventure:*' },
        );
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
          'game.price >= :minPrice',
          { minPrice: 20 },
        );
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
          'game.price <= :maxPrice',
          { maxPrice: 60 },
        );
      });

      it('should validate search parameters', async () => {
        await request(app.getHttpServer())
          .get('/api/games/search')
          .query({
            searchType: 'invalid',
            minPrice: -10,
            page: 0,
          })
          .expect(400);

        expect(mockQueryBuilder.getManyAndCount).not.toHaveBeenCalled();
      });

      it('should handle empty search results', async () => {
        mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

        const response = await request(app.getHttpServer())
          .get('/api/games/search')
          .query({ q: 'nonexistent' })
          .expect(200);

        expect(response.body.games).toHaveLength(0);
        expect(response.body.total).toBe(0);
      });

      it('should paginate search results', async () => {
        mockQueryBuilder.getManyAndCount.mockResolvedValue([
          mockGames.slice(0, 2),
          5,
        ]);

        const response = await request(app.getHttpServer())
          .get('/api/games/search')
          .query({ page: 1, limit: 2 })
          .expect(200);

        expect(response.body.games).toHaveLength(2);
        expect(response.body.hasNext).toBe(true);
        expect(response.body.total).toBe(5);
        expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
        expect(mockQueryBuilder.take).toHaveBeenCalledWith(2);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle repository errors gracefully', async () => {
      gameRepository.findAndCount.mockRejectedValue(
        new Error('Database connection lost'),
      );

      await request(app.getHttpServer()).get('/api/games').expect(500);
    });

    it('should handle cache service errors during game creation', async () => {
      const createGameDto: CreateGameDto = {
        title: 'Cache Error Test',
        price: 29.99,
        developer: 'Test Studio',
        publisher: 'Test Publisher',
        genre: 'Test',
      };

      const newGame = { 
        ...mockGame, 
        ...createGameDto, 
        releaseDate: new Date(mockGame.releaseDate),
        systemRequirements: mockGame.systemRequirements
      };
      gameRepository.create.mockReturnValue(newGame);
      gameRepository.save.mockResolvedValue(newGame);
      
      // Mock cache service to not throw error during game creation
      cacheService.invalidateGameCache.mockResolvedValue(undefined);

      // Should create the game successfully
      const response = await request(app.getHttpServer())
        .post('/api/games')
        .send(createGameDto)
        .expect(201);

      expect(response.body.title).toBe(createGameDto.title);
    });

    it('should handle search service errors gracefully', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockRejectedValue(new Error('Search error')),
      };

      gameRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );

      const response = await request(app.getHttpServer())
        .get('/api/games/search')
        .query({ q: 'test' })
        .expect(200);

      // Should return empty results instead of error
      expect(response.body.games).toHaveLength(0);
      expect(response.body.total).toBe(0);
    });
  });

  describe('API Response Format Consistency', () => {
    it('should return consistent game object format', async () => {
      gameRepository.findOneBy.mockResolvedValue(mockGame);

      const response = await request(app.getHttpServer())
        .get(`/api/games/${mockGame.id}`)
        .expect(200);

      // Verify all required fields are present
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('price');
      expect(response.body).toHaveProperty('currency');
      expect(response.body).toHaveProperty('genre');
      expect(response.body).toHaveProperty('developer');
      expect(response.body).toHaveProperty('available');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');

      // Verify data types
      expect(typeof response.body.id).toBe('string');
      expect(typeof response.body.title).toBe('string');
      expect(typeof response.body.price).toBe('number');
      expect(typeof response.body.available).toBe('boolean');
    });

    it('should return consistent list response format', async () => {
      gameRepository.findAndCount.mockResolvedValue([
        mockGames,
        mockGames.length,
      ]);

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(200);

      // Verify list response structure
      expect(response.body).toHaveProperty('games');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('hasNext');

      expect(Array.isArray(response.body.games)).toBe(true);
      expect(typeof response.body.total).toBe('number');
      expect(typeof response.body.hasNext).toBe('boolean');
    });

    it('should return consistent error response format', async () => {
      await request(app.getHttpServer())
        .get('/api/games/invalid-uuid')
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('error');
          expect(res.body.error).toHaveProperty('code');
          expect(res.body.error).toHaveProperty('message');
          expect(typeof res.body.error.code).toBe('string');
          expect(typeof res.body.error.message).toBe('string');
        });
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      await request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body.status).toBe('ok');
        });
    });
  });
});