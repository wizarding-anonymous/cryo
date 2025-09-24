import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { LibraryRepository } from './library.repository';
import { LibraryGame } from '../../entities/library-game.entity';
import { LibraryQueryDto } from '../dto';
import { SortBy, SortOrder } from '../../common/enums';

describe('LibraryRepository', () => {
  let repository: LibraryRepository;
  let typeormRepository: Repository<LibraryGame>;

  const mockTypeormRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LibraryRepository,
        {
          provide: getRepositoryToken(LibraryGame),
          useValue: mockTypeormRepository,
        },
      ],
    }).compile();

    repository = module.get<LibraryRepository>(LibraryRepository);
    typeormRepository = module.get<Repository<LibraryGame>>(
      getRepositoryToken(LibraryGame),
    );
    jest.clearAllMocks();
  });

  describe('findUserLibrary', () => {
    it('returns user library with pagination', async () => {
      const userId = 'user123';
      const queryDto = new LibraryQueryDto();
      queryDto.page = 1;
      queryDto.limit = 20;
      queryDto.sortBy = SortBy.PURCHASE_DATE;
      queryDto.sortOrder = SortOrder.DESC;

      const mockGames = [new LibraryGame()];
      const mockCount = 1;

      mockTypeormRepository.findAndCount.mockResolvedValue([
        mockGames,
        mockCount,
      ]);

      const result = await repository.findUserLibrary(userId, queryDto);

      expect(result).toEqual([mockGames, mockCount]);
      expect(typeormRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          order: { purchaseDate: 'DESC' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('maps price sort to purchasePrice column', async () => {
      const userId = 'user123';
      const queryDto = new LibraryQueryDto();
      queryDto.sortBy = SortBy.PRICE;
      queryDto.sortOrder = SortOrder.ASC;

      mockTypeormRepository.findAndCount.mockResolvedValue([[], 0]);

      await repository.findUserLibrary(userId, queryDto);

      expect(typeormRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { purchasePrice: 'ASC' },
        }),
      );
    });

    it('maps developer sort to gameId column', async () => {
      const userId = 'user123';
      const queryDto = new LibraryQueryDto();
      queryDto.sortBy = SortBy.DEVELOPER;
      queryDto.sortOrder = SortOrder.ASC;

      mockTypeormRepository.findAndCount.mockResolvedValue([[], 0]);

      await repository.findUserLibrary(userId, queryDto);

      expect(typeormRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { gameId: 'ASC' },
        }),
      );
    });

    it('maps title sort to gameId column', async () => {
      const userId = 'user123';
      const queryDto = new LibraryQueryDto();
      queryDto.sortBy = SortBy.TITLE;
      queryDto.sortOrder = SortOrder.DESC;

      mockTypeormRepository.findAndCount.mockResolvedValue([[], 0]);

      await repository.findUserLibrary(userId, queryDto);

      expect(typeormRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { gameId: 'DESC' },
        }),
      );
    });

    it('falls back to purchaseDate when sortBy is undefined', async () => {
      const userId = 'user123';
      const queryDto = new LibraryQueryDto();
      queryDto.sortBy = undefined;
      queryDto.sortOrder = undefined;

      mockTypeormRepository.findAndCount.mockResolvedValue([[], 0]);

      await repository.findUserLibrary(userId, queryDto);

      expect(typeormRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { purchaseDate: 'DESC' },
        }),
      );
    });
  });

  describe('findOneByUserIdAndGameId', () => {
    it('returns game when found', async () => {
      const userId = 'user123';
      const gameId = 'game456';
      const mockGame = new LibraryGame();

      mockTypeormRepository.findOne.mockResolvedValue(mockGame);

      const result = await repository.findOneByUserIdAndGameId(userId, gameId);

      expect(result).toEqual(mockGame);
      expect(typeormRepository.findOne).toHaveBeenCalledWith({
        where: { userId, gameId },
      });
    });

    it('returns null when game not found', async () => {
      mockTypeormRepository.findOne.mockResolvedValue(null);

      const result = await repository.findOneByUserIdAndGameId(
        'user123',
        'game456',
      );

      expect(result).toBeNull();
    });
  });

  describe('findUserLibraryWithLatestPurchase', () => {
    it('builds left join to latest purchase and paginates/sorts', async () => {
      const userId = 'user123';
      const queryDto = new LibraryQueryDto();
      queryDto.page = 1;
      queryDto.limit = 5;
      queryDto.sortBy = SortBy.PURCHASE_DATE;
      queryDto.sortOrder = SortOrder.DESC;

      const qb: Partial<SelectQueryBuilder<any>> = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);
      mockTypeormRepository.count.mockResolvedValue(0);

      const result = await repository.findUserLibraryWithLatestPurchase(
        userId,
        queryDto,
      );

      expect(result).toEqual([[], 0]);
      expect(mockTypeormRepository.createQueryBuilder).toHaveBeenCalledWith(
        'lg',
      );
      expect(qb.leftJoin).toHaveBeenCalled();
      expect(qb.where).toHaveBeenCalledWith('lg."userId" = :userId', {
        userId,
      });
      expect(qb.orderBy).toHaveBeenCalledWith('lg."purchaseDate"', 'DESC');
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(5);
      expect(qb.select).toHaveBeenCalled();
      expect(qb.getRawMany).toHaveBeenCalled();
      expect(mockTypeormRepository.count).toHaveBeenCalledWith({
        where: { userId },
      });
    });
  });

  describe('searchUserLibrary', () => {
    it('applies search filters and returns results', async () => {
      const userId = 'user123';
      const searchOptions = {
        gameIds: ['game1', 'game2'],
        priceRange: { min: 10, max: 50 },
        currencies: ['USD', 'EUR'],
      };
      const queryDto = new LibraryQueryDto();

      const qb: Partial<SelectQueryBuilder<LibraryGame>> = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await repository.searchUserLibrary(
        userId,
        searchOptions,
        queryDto,
      );

      expect(result).toEqual([[], 0]);
      expect(qb.where).toHaveBeenCalledWith('lg."userId" = :userId', {
        userId,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('lg."gameId" IN (:...gameIds)', {
        gameIds: searchOptions.gameIds,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'lg."purchasePrice" >= :minPrice',
        { minPrice: 10 },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'lg."purchasePrice" <= :maxPrice',
        { maxPrice: 50 },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'lg."currency" IN (:...currencies)',
        { currencies: searchOptions.currencies },
      );
    });
  });

  describe('getUserLibraryStats', () => {
    it('returns library statistics for user', async () => {
      const userId = 'user123';
      const mockStats = {
        totalGames: 5,
        totalSpent: '150.00',
        averagePrice: '30.00',
        currencies: ['USD', 'EUR'],
        oldestPurchase: new Date('2024-01-01'),
        newestPurchase: new Date('2024-12-01'),
      };

      const qb: Partial<SelectQueryBuilder<LibraryGame>> = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(mockStats),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await repository.getUserLibraryStats(userId);

      expect(result).toEqual({
        totalGames: 5,
        totalSpent: 150.0,
        averagePrice: 30.0,
        currencies: ['USD', 'EUR'],
        oldestPurchase: new Date('2024-01-01'),
        newestPurchase: new Date('2024-12-01'),
      });
    });
  });

  describe('findMultipleByGameIds', () => {
    it('returns empty array for empty gameIds', async () => {
      const result = await repository.findMultipleByGameIds('user123', []);
      expect(result).toEqual([]);
    });

    it('finds games by multiple game IDs', async () => {
      const userId = 'user123';
      const gameIds = ['game1', 'game2'];
      const mockGames = [new LibraryGame(), new LibraryGame()];

      const qb: Partial<SelectQueryBuilder<LibraryGame>> = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockGames),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await repository.findMultipleByGameIds(userId, gameIds);

      expect(result).toEqual(mockGames);
      expect(qb.where).toHaveBeenCalledWith('lg."userId" = :userId', {
        userId,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('lg."gameId" IN (:...gameIds)', {
        gameIds,
      });
    });
  });

  describe('fullTextSearchLibrary', () => {
    it('performs full-text search with Brackets for OR conditions', async () => {
      const userId = 'user123';
      const searchQuery = 'test game';
      const queryDto = new LibraryQueryDto();

      const qb: Partial<SelectQueryBuilder<LibraryGame>> = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await repository.fullTextSearchLibrary(
        userId,
        searchQuery,
        queryDto,
      );

      expect(result).toEqual([[], 0]);
      expect(qb.where).toHaveBeenCalledWith('lg."userId" = :userId', {
        userId,
      });
      expect(qb.andWhere).toHaveBeenCalled(); // Brackets usage
      expect(qb.orderBy).toHaveBeenCalled();
    });
  });

  describe('bulkUpsertLibraryGames', () => {
    it('returns early for empty array', async () => {
      await repository.bulkUpsertLibraryGames([]);

      expect(mockTypeormRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('performs bulk upsert with conflict resolution', async () => {
      const libraryGames = [
        {
          userId: 'user1',
          gameId: 'game1',
          purchaseDate: new Date(),
          purchasePrice: 29.99,
          currency: 'USD',
          orderId: 'order1',
          purchaseId: 'purchase1',
        },
      ];

      const qb: Partial<any> = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orUpdate: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);

      await repository.bulkUpsertLibraryGames(libraryGames);

      expect(mockTypeormRepository.createQueryBuilder).toHaveBeenCalled();
      expect(qb.insert).toHaveBeenCalled();
      expect(qb.into).toHaveBeenCalled();
      expect(qb.values).toHaveBeenCalled();
      expect(qb.orUpdate).toHaveBeenCalled();
      expect(qb.execute).toHaveBeenCalled();
    });
  });

  describe('findLibraryWithOptimization', () => {
    it('applies optimization hints and caching', async () => {
      const userId = 'user123';
      const filters = { userId, gameId: 'game1' };
      const queryDto = new LibraryQueryDto();

      const qb: Partial<SelectQueryBuilder<LibraryGame>> = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        cache: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await repository.findLibraryWithOptimization(
        userId,
        filters,
        queryDto,
      );

      expect(result).toEqual([[], 0]);
      expect(qb.cache).toHaveBeenCalledWith(30000);
      expect(qb.andWhere).toHaveBeenCalledWith('lg."gameId" = :gameId', {
        gameId: 'game1',
      });
    });
  });

  describe('searchUserLibrary - additional coverage', () => {
    it('applies date range filters when provided', async () => {
      const userId = 'user123';
      const searchOptions = {
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31'),
        },
      };
      const queryDto = new LibraryQueryDto();

      const qb: Partial<SelectQueryBuilder<LibraryGame>> = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);

      await repository.searchUserLibrary(userId, searchOptions, queryDto);

      expect(qb.andWhere).toHaveBeenCalledWith(
        'lg."purchaseDate" >= :dateFrom',
        {
          dateFrom: searchOptions.dateRange.from,
        },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('lg."purchaseDate" <= :dateTo', {
        dateTo: searchOptions.dateRange.to,
      });
    });

    it('applies only from date when to date is not provided', async () => {
      const userId = 'user123';
      const searchOptions = {
        dateRange: {
          from: new Date('2024-01-01'),
        },
      };
      const queryDto = new LibraryQueryDto();

      const qb: Partial<SelectQueryBuilder<LibraryGame>> = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);

      await repository.searchUserLibrary(userId, searchOptions, queryDto);

      expect(qb.andWhere).toHaveBeenCalledWith(
        'lg."purchaseDate" >= :dateFrom',
        {
          dateFrom: searchOptions.dateRange.from,
        },
      );
    });

    it('applies only to date when from date is not provided', async () => {
      const userId = 'user123';
      const searchOptions = {
        dateRange: {
          to: new Date('2024-12-31'),
        },
      };
      const queryDto = new LibraryQueryDto();

      const qb: Partial<SelectQueryBuilder<LibraryGame>> = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);

      await repository.searchUserLibrary(userId, searchOptions, queryDto);

      expect(qb.andWhere).toHaveBeenCalledWith('lg."purchaseDate" <= :dateTo', {
        dateTo: searchOptions.dateRange.to,
      });
    });

    it('handles empty currencies array', async () => {
      const userId = 'user123';
      const searchOptions = {
        currencies: [],
      };
      const queryDto = new LibraryQueryDto();

      const qb: Partial<SelectQueryBuilder<LibraryGame>> = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);

      await repository.searchUserLibrary(userId, searchOptions, queryDto);

      // Should not call andWhere for currencies when array is empty
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        'lg."currency" IN (:...currencies)',
        expect.any(Object),
      );
    });
  });

  describe('findWithFilters - additional coverage', () => {
    it('handles all filter options and sorting variations', async () => {
      const filters = {
        userId: 'user123',
        gameId: 'game1',
        orderId: 'order1',
        purchaseId: 'purchase1',
        priceMin: 10,
        priceMax: 50,
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-12-31'),
        currency: 'USD',
      };
      const queryDto = new LibraryQueryDto();
      queryDto.sortBy = SortBy.TITLE;
      queryDto.sortOrder = SortOrder.ASC;

      const qb: Partial<SelectQueryBuilder<LibraryGame>> = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await repository.findWithFilters(filters, queryDto);

      expect(result).toEqual([[], 0]);
      expect(qb.where).toHaveBeenCalledWith('lg."userId" = :userId', {
        userId: 'user123',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('lg."gameId" = :gameId', {
        gameId: 'game1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('lg."orderId" = :orderId', {
        orderId: 'order1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'lg."purchaseId" = :purchaseId',
        {
          purchaseId: 'purchase1',
        },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'lg."purchasePrice" >= :priceMin',
        {
          priceMin: 10,
        },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'lg."purchasePrice" <= :priceMax',
        {
          priceMax: 50,
        },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'lg."purchaseDate" >= :dateFrom',
        {
          dateFrom: filters.dateFrom,
        },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('lg."purchaseDate" <= :dateTo', {
        dateTo: filters.dateTo,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('lg."currency" = :currency', {
        currency: 'USD',
      });
      expect(qb.orderBy).toHaveBeenCalledWith('lg."gameId"', 'ASC');
    });

    it('uses default values when query parameters are undefined', async () => {
      const filters = { userId: 'user123' };
      const queryDto = {}; // Empty query DTO

      const qb: Partial<SelectQueryBuilder<LibraryGame>> = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);

      await repository.findWithFilters(filters, queryDto);

      expect(qb.orderBy).toHaveBeenCalledWith('lg."purchaseDate"', 'DESC');
      expect(qb.skip).toHaveBeenCalledWith(0); // (1-1) * 20
      expect(qb.take).toHaveBeenCalledWith(20);
    });
  });
});
