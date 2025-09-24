import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  PurchaseHistoryRepository,
  HistoryFilterOptions,
  HistorySearchOptions,
} from './purchase-history.repository';
import {
  PurchaseHistory,
  PurchaseStatus,
} from '../../entities/purchase-history.entity';
import { HistoryQueryDto } from '../dto';
import { HistorySortBy, SortOrder } from '../../common/enums';

describe('PurchaseHistoryRepository', () => {
  let repository: PurchaseHistoryRepository;
  // let typeormRepository: Repository<PurchaseHistory>;

  const mockTypeormRepository = {
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseHistoryRepository,
        {
          provide: getRepositoryToken(PurchaseHistory),
          useValue: mockTypeormRepository,
        },
      ],
    }).compile();

    repository = module.get<PurchaseHistoryRepository>(
      PurchaseHistoryRepository,
    );
    jest.clearAllMocks();
  });

  describe('findUserHistory', () => {
    it('returns user purchase history with pagination', async () => {
      const userId = 'user123';
      const queryDto = new HistoryQueryDto();
      queryDto.page = 1;
      queryDto.limit = 20;
      queryDto.sortBy = HistorySortBy.CREATED_AT;
      queryDto.sortOrder = SortOrder.DESC;

      const mockHistory = [new PurchaseHistory()];
      const mockCount = 1;

      mockTypeormRepository.findAndCount.mockResolvedValue([
        mockHistory,
        mockCount,
      ]);

      const result = await repository.findUserHistory(userId, queryDto);

      expect(result).toEqual([mockHistory, mockCount]);
      expect(mockTypeormRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          order: { createdAt: 'DESC' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('maps amount sort to amount column', async () => {
      const userId = 'user123';
      const queryDto = new HistoryQueryDto();
      queryDto.sortBy = HistorySortBy.AMOUNT;
      queryDto.sortOrder = SortOrder.ASC;

      mockTypeormRepository.findAndCount.mockResolvedValue([[], 0]);

      await repository.findUserHistory(userId, queryDto);

      expect(mockTypeormRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { amount: 'ASC' },
        }),
      );
    });

    it('uses default values when sortBy is undefined', async () => {
      const userId = 'user123';
      const queryDto = new HistoryQueryDto();
      queryDto.sortBy = undefined;
      queryDto.sortOrder = undefined;

      mockTypeormRepository.findAndCount.mockResolvedValue([[], 0]);

      await repository.findUserHistory(userId, queryDto);

      expect(mockTypeormRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { createdAt: 'DESC' },
        }),
      );
    });

    it('handles pagination correctly', async () => {
      const userId = 'user123';
      const queryDto = new HistoryQueryDto();
      queryDto.page = 3;
      queryDto.limit = 5;

      mockTypeormRepository.findAndCount.mockResolvedValue([[], 0]);

      await repository.findUserHistory(userId, queryDto);

      expect(mockTypeormRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (3-1) * 5
          take: 5,
        }),
      );
    });
  });

  describe('findUserHistoryWithFilters', () => {
    it('applies status filter when provided', async () => {
      const userId = 'user123';
      const queryDto = new HistoryQueryDto();
      const filters: HistoryFilterOptions = {
        status: PurchaseStatus.COMPLETED,
      };

      const qb: Partial<SelectQueryBuilder<PurchaseHistory>> = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await repository.findUserHistoryWithFilters(
        userId,
        queryDto,
        filters,
      );

      expect(result).toEqual([[], 0]);
      expect(qb.where).toHaveBeenCalledWith('ph."userId" = :userId', {
        userId,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('ph."status" = :status', {
        status: PurchaseStatus.COMPLETED,
      });
    });

    it('applies date range filters when provided', async () => {
      const userId = 'user123';
      const queryDto = new HistoryQueryDto();
      const filters: HistoryFilterOptions = {
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-12-31'),
      };

      const qb: Partial<SelectQueryBuilder<PurchaseHistory>> = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);

      await repository.findUserHistoryWithFilters(userId, queryDto, filters);

      expect(qb.andWhere).toHaveBeenCalledWith('ph."createdAt" >= :dateFrom', {
        dateFrom: filters.dateFrom,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('ph."createdAt" <= :dateTo', {
        dateTo: filters.dateTo,
      });
    });

    it('applies amount range filters when provided', async () => {
      const userId = 'user123';
      const queryDto = new HistoryQueryDto();
      const filters: HistoryFilterOptions = {
        minAmount: 10,
        maxAmount: 50,
      };

      const qb: Partial<SelectQueryBuilder<PurchaseHistory>> = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);

      await repository.findUserHistoryWithFilters(userId, queryDto, filters);

      expect(qb.andWhere).toHaveBeenCalledWith('ph."amount" >= :minAmount', {
        minAmount: 10,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('ph."amount" <= :maxAmount', {
        maxAmount: 50,
      });
    });

    it('applies game and order ID filters when provided', async () => {
      const userId = 'user123';
      const queryDto = new HistoryQueryDto();
      const filters: HistoryFilterOptions = {
        gameId: 'game1',
        orderId: 'order1',
      };

      const qb: Partial<SelectQueryBuilder<PurchaseHistory>> = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);

      await repository.findUserHistoryWithFilters(userId, queryDto, filters);

      expect(qb.andWhere).toHaveBeenCalledWith('ph."gameId" = :gameId', {
        gameId: 'game1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('ph."orderId" = :orderId', {
        orderId: 'order1',
      });
    });
  });

  describe('searchUserHistory', () => {
    it('applies search filters and returns results', async () => {
      const userId = 'user123';
      const searchOptions: HistorySearchOptions = {
        statuses: [PurchaseStatus.COMPLETED, PurchaseStatus.REFUNDED],
        gameIds: ['game1', 'game2'],
        amountRange: { min: 10, max: 100 },
        query: 'test search',
      };
      const queryDto = new HistoryQueryDto();

      const qb: Partial<SelectQueryBuilder<PurchaseHistory>> = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await repository.searchUserHistory(
        userId,
        searchOptions,
        queryDto,
      );

      expect(result).toEqual([[], 0]);
      expect(qb.where).toHaveBeenCalledWith('ph."userId" = :userId', {
        userId,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'ph."status" IN (:...statuses)',
        { statuses: [PurchaseStatus.COMPLETED, PurchaseStatus.REFUNDED] },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('ph."gameId" IN (:...gameIds)', {
        gameIds: searchOptions.gameIds,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('ph."amount" >= :minAmount', {
        minAmount: 10,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('ph."amount" <= :maxAmount', {
        maxAmount: 100,
      });
    });
  });

  describe('getUserPurchaseStats', () => {
    it('returns purchase statistics for user', async () => {
      const userId = 'user123';
      const mockBasicStats = {
        totalPurchases: 10,
        totalSpent: '500.00',
        averageAmount: '50.00',
        completedPurchases: 8,
        refundedPurchases: 1,
        cancelledPurchases: 1,
      };

      const qb: Partial<SelectQueryBuilder<PurchaseHistory>> = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(mockBasicStats),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await repository.getUserPurchaseStats(userId);

      expect(result.totalPurchases).toBe(10);
      expect(result.totalSpent).toBe(500.0);
      expect(result.averageAmount).toBe(50.0);
      expect(result.completedPurchases).toBe(8);
      expect(result.refundedPurchases).toBe(1);
      expect(result.cancelledPurchases).toBe(1);
    });
  });

  describe('findByOrderIds', () => {
    it('returns empty array for empty order IDs', async () => {
      const result = await repository.findByOrderIds([]);
      expect(result).toEqual([]);
    });

    it('finds purchases by multiple order IDs', async () => {
      const orderIds = ['order1', 'order2'];
      const mockPurchases = [new PurchaseHistory(), new PurchaseHistory()];

      const qb: Partial<SelectQueryBuilder<PurchaseHistory>> = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockPurchases),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await repository.findByOrderIds(orderIds);

      expect(result).toEqual(mockPurchases);
      expect(qb.where).toHaveBeenCalledWith('ph."orderId" IN (:...orderIds)', {
        orderIds,
      });
    });
  });

  describe('findRecentPurchases', () => {
    it('finds recent purchases for user', async () => {
      const userId = 'user123';
      const days = 30;
      const limit = 10;
      const mockPurchases = [new PurchaseHistory()];

      const qb: Partial<SelectQueryBuilder<PurchaseHistory>> = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockPurchases),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await repository.findRecentPurchases(userId, days, limit);

      expect(result).toEqual(mockPurchases);
      expect(qb.where).toHaveBeenCalledWith('ph."userId" = :userId', {
        userId,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'ph."createdAt" >= :startDate',
        expect.objectContaining({
          startDate: expect.any(Date),
        }),
      );
      expect(qb.orderBy).toHaveBeenCalledWith('ph."createdAt"', 'DESC');
      expect(qb.limit).toHaveBeenCalledWith(limit);
    });
  });

  describe('bulkUpsertPurchaseHistory', () => {
    it('returns early for empty array', async () => {
      await repository.bulkUpsertPurchaseHistory([]);

      expect(mockTypeormRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('performs bulk upsert with conflict resolution', async () => {
      const purchases = [
        {
          userId: 'user1',
          gameId: 'game1',
          orderId: 'order1',
          amount: 29.99,
          currency: 'USD',
          status: PurchaseStatus.COMPLETED,
          paymentMethod: 'credit_card',
          metadata: { test: 'data' },
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

      await repository.bulkUpsertPurchaseHistory(purchases);

      expect(mockTypeormRepository.createQueryBuilder).toHaveBeenCalled();
      expect(qb.insert).toHaveBeenCalled();
      expect(qb.into).toHaveBeenCalled();
      expect(qb.values).toHaveBeenCalled();
      expect(qb.orUpdate).toHaveBeenCalled();
      expect(qb.execute).toHaveBeenCalled();
    });
  });
});
