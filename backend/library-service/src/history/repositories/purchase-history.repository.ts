import { Injectable } from '@nestjs/common';
import {
  Repository,
  type FindOptionsOrder,
  SelectQueryBuilder,
  Brackets,
} from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  PurchaseHistory,
  PurchaseStatus,
} from '../../entities/purchase-history.entity';
import { HistoryQueryDto } from '../dto';
import { HistorySortBy } from '../../common/enums';
import { LibraryGame } from '../../entities/library-game.entity';

interface NormalizedHistoryQuery {
  page: number;
  limit: number;
  sortBy: HistorySortBy;
  sortOrder: 'asc' | 'desc';
}

export interface HistoryFilterOptions {
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
  gameId?: string;
  orderId?: string;
  paymentMethod?: string;
  currency?: string;
}

export interface HistorySearchOptions {
  query?: string;
  statuses?: PurchaseStatus[];
  gameIds?: string[];
  orderIds?: string[];
  paymentMethods?: string[];
  currencies?: string[];
  amountRange?: { min?: number; max?: number };
  dateRange?: { from?: Date; to?: Date };
}

@Injectable()
export class PurchaseHistoryRepository extends Repository<PurchaseHistory> {
  constructor(
    @InjectRepository(PurchaseHistory)
    private readonly repository: Repository<PurchaseHistory>,
  ) {
    super(repository.target, repository.manager, repository.queryRunner);
  }

  async findUserHistory(
    userId: string,
    queryDto: HistoryQueryDto | NormalizedHistoryQuery,
  ): Promise<[PurchaseHistory[], number]> {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const sortBy = queryDto.sortBy ?? HistorySortBy.CREATED_AT;
    const sortOrder = queryDto.sortOrder ?? 'desc';

    const orderDirection: 'ASC' | 'DESC' =
      sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const order: FindOptionsOrder<PurchaseHistory> = {
      [sortBy]: orderDirection,
    } as FindOptionsOrder<PurchaseHistory>;

    return this.repository.findAndCount({
      where: { userId },
      skip: (page - 1) * limit,
      take: limit,
      order,
    });
  }

  async findUserHistoryWithFilters(
    userId: string,
    queryDto: HistoryQueryDto | NormalizedHistoryQuery,
    filters: HistoryFilterOptions = {},
  ): Promise<[PurchaseHistory[], number]> {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const sortBy = queryDto.sortBy ?? HistorySortBy.CREATED_AT;
    const sortOrder =
      (queryDto.sortOrder ?? 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let qb: SelectQueryBuilder<PurchaseHistory> = this.repository
      .createQueryBuilder('ph')
      .where('ph."userId" = :userId', { userId });

    if (filters.status) {
      qb = qb.andWhere('ph."status" = :status', { status: filters.status });
    }
    if (filters.dateFrom) {
      qb = qb.andWhere('ph."createdAt" >= :dateFrom', {
        dateFrom: filters.dateFrom,
      });
    }
    if (filters.dateTo) {
      qb = qb.andWhere('ph."createdAt" <= :dateTo', { dateTo: filters.dateTo });
    }
    if (typeof filters.minAmount === 'number') {
      qb = qb.andWhere('ph."amount" >= :minAmount', {
        minAmount: filters.minAmount,
      });
    }
    if (typeof filters.maxAmount === 'number') {
      qb = qb.andWhere('ph."amount" <= :maxAmount', {
        maxAmount: filters.maxAmount,
      });
    }
    if (filters.gameId) {
      qb = qb.andWhere('ph."gameId" = :gameId', { gameId: filters.gameId });
    }
    if (filters.orderId) {
      qb = qb.andWhere('ph."orderId" = :orderId', { orderId: filters.orderId });
    }
    if (filters.paymentMethod) {
      qb = qb.andWhere('ph."paymentMethod" = :paymentMethod', {
        paymentMethod: filters.paymentMethod,
      });
    }
    if (filters.currency) {
      qb = qb.andWhere('ph."currency" = :currency', {
        currency: filters.currency,
      });
    }

    qb = qb
      .orderBy(`ph."${sortBy}"`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, count] = await qb.getManyAndCount();
    return [rows, count];
  }

  /**
   * Advanced search in purchase history with complex filtering
   */
  async searchUserHistory(
    userId: string,
    searchOptions: HistorySearchOptions,
    queryDto: HistoryQueryDto | NormalizedHistoryQuery,
  ): Promise<[PurchaseHistory[], number]> {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const sortBy = queryDto.sortBy ?? HistorySortBy.CREATED_AT;
    const sortOrder =
      (queryDto.sortOrder ?? 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let qb = this.repository
      .createQueryBuilder('ph')
      .where('ph."userId" = :userId', { userId });

    // Apply search filters
    if (searchOptions.statuses && searchOptions.statuses.length > 0) {
      qb = qb.andWhere('ph."status" IN (:...statuses)', {
        statuses: searchOptions.statuses,
      });
    }

    if (searchOptions.gameIds && searchOptions.gameIds.length > 0) {
      qb = qb.andWhere('ph."gameId" IN (:...gameIds)', {
        gameIds: searchOptions.gameIds,
      });
    }

    if (searchOptions.orderIds && searchOptions.orderIds.length > 0) {
      qb = qb.andWhere('ph."orderId" IN (:...orderIds)', {
        orderIds: searchOptions.orderIds,
      });
    }

    if (
      searchOptions.paymentMethods &&
      searchOptions.paymentMethods.length > 0
    ) {
      qb = qb.andWhere('ph."paymentMethod" IN (:...paymentMethods)', {
        paymentMethods: searchOptions.paymentMethods,
      });
    }

    if (searchOptions.currencies && searchOptions.currencies.length > 0) {
      qb = qb.andWhere('ph."currency" IN (:...currencies)', {
        currencies: searchOptions.currencies,
      });
    }

    if (searchOptions.amountRange) {
      if (searchOptions.amountRange.min !== undefined) {
        qb = qb.andWhere('ph."amount" >= :minAmount', {
          minAmount: searchOptions.amountRange.min,
        });
      }
      if (searchOptions.amountRange.max !== undefined) {
        qb = qb.andWhere('ph."amount" <= :maxAmount', {
          maxAmount: searchOptions.amountRange.max,
        });
      }
    }

    if (searchOptions.dateRange) {
      if (searchOptions.dateRange.from) {
        qb = qb.andWhere('ph."createdAt" >= :dateFrom', {
          dateFrom: searchOptions.dateRange.from,
        });
      }
      if (searchOptions.dateRange.to) {
        qb = qb.andWhere('ph."createdAt" <= :dateTo', {
          dateTo: searchOptions.dateRange.to,
        });
      }
    }

    // Apply text search in metadata if query is provided
    if (searchOptions.query) {
      qb = qb.andWhere(
        new Brackets((qb) => {
          qb.where('ph."orderId" ILIKE :query', {
            query: `%${searchOptions.query}%`,
          })
            .orWhere('ph."paymentMethod" ILIKE :query', {
              query: `%${searchOptions.query}%`,
            })
            .orWhere('ph."metadata"::text ILIKE :query', {
              query: `%${searchOptions.query}%`,
            });
        }),
      );
    }

    // Apply sorting and pagination
    qb = qb
      .orderBy(`ph."${sortBy}"`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    return qb.getManyAndCount();
  }

  /**
   * Get purchase history with library game information using JOIN
   */
  async findUserHistoryWithLibraryInfo(
    userId: string,
    queryDto: HistoryQueryDto | NormalizedHistoryQuery,
  ): Promise<
    [
      Array<
        PurchaseHistory & {
          libraryGameId: string | null;
          libraryPurchaseDate: Date | null;
          libraryPurchasePrice: number | null;
        }
      >,
      number,
    ]
  > {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const sortBy = queryDto.sortBy ?? HistorySortBy.CREATED_AT;
    const sortOrder =
      (queryDto.sortOrder ?? 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.repository
      .createQueryBuilder('ph')
      .leftJoin(
        LibraryGame,
        'lg',
        'lg."userId" = ph."userId" AND lg."gameId" = ph."gameId"',
      )
      .where('ph."userId" = :userId', { userId })
      .orderBy(`ph."${sortBy}"`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit)
      .select([
        'ph.id as id',
        'ph."userId" as "userId"',
        'ph."gameId" as "gameId"',
        'ph."orderId" as "orderId"',
        'ph.amount as amount',
        'ph.currency as currency',
        'ph.status as status',
        'ph."paymentMethod" as "paymentMethod"',
        'ph.metadata as metadata',
        'ph."createdAt" as "createdAt"',
        'ph."updatedAt" as "updatedAt"',
        'lg.id as "libraryGameId"',
        'lg."purchaseDate" as "libraryPurchaseDate"',
        'lg."purchasePrice" as "libraryPurchasePrice"',
      ]);

    const [rows, count] = await Promise.all([
      qb.getRawMany<
        PurchaseHistory & {
          libraryGameId: string | null;
          libraryPurchaseDate: Date | null;
          libraryPurchasePrice: number | null;
        }
      >(),
      this.repository.count({ where: { userId } }),
    ]);

    return [rows, count];
  }

  /**
   * Get aggregated purchase statistics for a user
   */
  async getUserPurchaseStats(userId: string): Promise<{
    totalPurchases: number;
    totalSpent: number;
    averageAmount: number;
    completedPurchases: number;
    refundedPurchases: number;
    cancelledPurchases: number;
    paymentMethods: Array<{ method: string; count: number; total: number }>;
    currencies: Array<{ currency: string; count: number; total: number }>;
    monthlyStats: Array<{ month: string; count: number; total: number }>;
  }> {
    // Get basic stats
    const basicStats = await this.repository
      .createQueryBuilder('ph')
      .where('ph."userId" = :userId', { userId })
      .select([
        'COUNT(*)::int as "totalPurchases"',
        'SUM(ph.amount) as "totalSpent"',
        'AVG(ph.amount) as "averageAmount"',
        'COUNT(CASE WHEN ph.status = \'completed\' THEN 1 END)::int as "completedPurchases"',
        'COUNT(CASE WHEN ph.status = \'refunded\' THEN 1 END)::int as "refundedPurchases"',
        'COUNT(CASE WHEN ph.status = \'cancelled\' THEN 1 END)::int as "cancelledPurchases"',
      ])
      .getRawOne();

    // Get payment method stats
    const paymentMethodStats = await this.repository
      .createQueryBuilder('ph')
      .where('ph."userId" = :userId', { userId })
      .groupBy('ph."paymentMethod"')
      .select([
        'ph."paymentMethod" as method',
        'COUNT(*)::int as count',
        'SUM(ph.amount) as total',
      ])
      .getRawMany();

    // Get currency stats
    const currencyStats = await this.repository
      .createQueryBuilder('ph')
      .where('ph."userId" = :userId', { userId })
      .groupBy('ph.currency')
      .select([
        'ph.currency as currency',
        'COUNT(*)::int as count',
        'SUM(ph.amount) as total',
      ])
      .getRawMany();

    // Get monthly stats for the last 12 months
    const monthlyStats = await this.repository
      .createQueryBuilder('ph')
      .where('ph."userId" = :userId', { userId })
      .andWhere('ph."createdAt" >= :startDate', {
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      })
      .groupBy('DATE_TRUNC(\'month\', ph."createdAt")')
      .orderBy('DATE_TRUNC(\'month\', ph."createdAt")', 'ASC')
      .select([
        "TO_CHAR(DATE_TRUNC('month', ph.\"createdAt\"), 'YYYY-MM') as month",
        'COUNT(*)::int as count',
        'SUM(ph.amount) as total',
      ])
      .getRawMany();

    return {
      totalPurchases: basicStats?.totalPurchases || 0,
      totalSpent: parseFloat(basicStats?.totalSpent || '0'),
      averageAmount: parseFloat(basicStats?.averageAmount || '0'),
      completedPurchases: basicStats?.completedPurchases || 0,
      refundedPurchases: basicStats?.refundedPurchases || 0,
      cancelledPurchases: basicStats?.cancelledPurchases || 0,
      paymentMethods: paymentMethodStats.map((stat) => ({
        method: stat.method,
        count: stat.count,
        total: parseFloat(stat.total || '0'),
      })),
      currencies: currencyStats.map((stat) => ({
        currency: stat.currency,
        count: stat.count,
        total: parseFloat(stat.total || '0'),
      })),
      monthlyStats: monthlyStats.map((stat) => ({
        month: stat.month,
        count: stat.count,
        total: parseFloat(stat.total || '0'),
      })),
    };
  }

  /**
   * Find purchases by multiple order IDs for bulk operations
   */
  async findByOrderIds(orderIds: string[]): Promise<PurchaseHistory[]> {
    if (orderIds.length === 0) return [];

    return this.repository
      .createQueryBuilder('ph')
      .where('ph."orderId" IN (:...orderIds)', { orderIds })
      .getMany();
  }

  /**
   * Find recent purchases for a user (last N days)
   */
  async findRecentPurchases(
    userId: string,
    days: number = 30,
    limit: number = 10,
  ): Promise<PurchaseHistory[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return this.repository
      .createQueryBuilder('ph')
      .where('ph."userId" = :userId', { userId })
      .andWhere('ph."createdAt" >= :startDate', { startDate })
      .orderBy('ph."createdAt"', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * Get purchase history grouped by status with counts
   */
  async getPurchaseStatusSummary(userId: string): Promise<
    Array<{
      status: PurchaseStatus;
      count: number;
      totalAmount: number;
    }>
  > {
    return this.repository
      .createQueryBuilder('ph')
      .where('ph."userId" = :userId', { userId })
      .groupBy('ph.status')
      .select([
        'ph.status as status',
        'COUNT(*)::int as count',
        'SUM(ph.amount) as "totalAmount"',
      ])
      .getRawMany()
      .then((results) =>
        results.map((result) => ({
          status: result.status,
          count: result.count,
          totalAmount: parseFloat(result.totalAmount || '0'),
        })),
      );
  }

  /**
   * Optimized bulk insert for purchase history with conflict resolution
   * Uses PostgreSQL UPSERT for better performance
   */
  async bulkUpsertPurchaseHistory(
    purchases: Partial<PurchaseHistory>[],
  ): Promise<void> {
    if (purchases.length === 0) return;

    // Use TypeORM's save method with upsert for better type safety
    const entities = purchases.map((purchase) => {
      const entity = new PurchaseHistory();
      Object.assign(entity, purchase);
      return entity;
    });

    // Use TypeORM's upsert functionality
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(PurchaseHistory)
      .values(entities)
      .orUpdate(
        ['status', 'paymentMethod', 'metadata', 'updatedAt'],
        ['orderId'],
      )
      .execute();
  }

  /**
   * Advanced analytics query for purchase trends
   * Uses window functions for better performance
   */
  async getPurchaseTrends(
    userId: string,
    months: number = 12,
  ): Promise<
    Array<{
      month: string;
      totalPurchases: number;
      totalAmount: number;
      averageAmount: number;
      uniqueGames: number;
      trendDirection: 'up' | 'down' | 'stable';
    }>
  > {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const qb: SelectQueryBuilder<PurchaseHistory> = this.repository
      .createQueryBuilder('ph')
      .where('ph."userId" = :userId', { userId })
      .andWhere('ph."createdAt" >= :startDate', { startDate })
      .andWhere('ph.status = :status', { status: PurchaseStatus.COMPLETED });

    const results = await qb
      .select([
        "TO_CHAR(DATE_TRUNC('month', ph.\"createdAt\"), 'YYYY-MM') as month",
        'COUNT(*)::int as "totalPurchases"',
        'SUM(ph.amount) as "totalAmount"',
        'AVG(ph.amount) as "averageAmount"',
        'COUNT(DISTINCT ph."gameId")::int as "uniqueGames"',
        'LAG(SUM(ph.amount)) OVER (ORDER BY DATE_TRUNC(\'month\', ph."createdAt")) as "previousAmount"',
      ])
      .groupBy('DATE_TRUNC(\'month\', ph."createdAt")')
      .orderBy('DATE_TRUNC(\'month\', ph."createdAt")', 'ASC')
      .getRawMany();

    return results.map((result) => {
      const currentAmount = parseFloat(result.totalAmount || '0');
      const previousAmount = parseFloat(result.previousAmount || '0');
      let trendDirection: 'up' | 'down' | 'stable' = 'stable';

      if (previousAmount > 0) {
        const change =
          ((currentAmount - previousAmount) / previousAmount) * 100;
        if (change > 5) trendDirection = 'up';
        else if (change < -5) trendDirection = 'down';
      }

      return {
        month: result.month,
        totalPurchases: result.totalPurchases,
        totalAmount: currentAmount,
        averageAmount: parseFloat(result.averageAmount || '0'),
        uniqueGames: result.uniqueGames,
        trendDirection,
      };
    });
  }

  /**
   * Complex JOIN query with purchase history and library games
   * Uses advanced filtering with Brackets for complex conditions
   */
  async findPurchaseHistoryWithComplexFilters(
    userId: string,
    filters: {
      statusGroups?: PurchaseStatus[][];
      amountRanges?: Array<{ min: number; max: number }>;
      dateRanges?: Array<{ from: Date; to: Date }>;
      gameCategories?: string[];
      paymentMethodGroups?: string[][];
    },
    queryDto: HistoryQueryDto | NormalizedHistoryQuery,
  ): Promise<[PurchaseHistory[], number]> {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const sortBy = queryDto.sortBy ?? HistorySortBy.CREATED_AT;
    const sortOrder =
      (queryDto.sortOrder ?? 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let qb: SelectQueryBuilder<PurchaseHistory> = this.repository
      .createQueryBuilder('ph')
      .where('ph."userId" = :userId', { userId });

    // Complex status filtering using Brackets
    if (filters.statusGroups && filters.statusGroups.length > 0) {
      qb = qb.andWhere(
        new Brackets((qb) => {
          filters.statusGroups!.forEach((statusGroup, index) => {
            if (index === 0) {
              qb.where('ph.status IN (:...statusGroup0)', {
                statusGroup0: statusGroup,
              });
            } else {
              qb.orWhere(`ph.status IN (:...statusGroup${index})`, {
                [`statusGroup${index}`]: statusGroup,
              });
            }
          });
        }),
      );
    }

    // Complex amount range filtering
    if (filters.amountRanges && filters.amountRanges.length > 0) {
      qb = qb.andWhere(
        new Brackets((qb) => {
          filters.amountRanges!.forEach((range, index) => {
            const condition =
              'ph.amount BETWEEN :minAmount' +
              index +
              ' AND :maxAmount' +
              index;
            const params = {
              [`minAmount${index}`]: range.min,
              [`maxAmount${index}`]: range.max,
            };

            if (index === 0) {
              qb.where(condition, params);
            } else {
              qb.orWhere(condition, params);
            }
          });
        }),
      );
    }

    // Complex date range filtering
    if (filters.dateRanges && filters.dateRanges.length > 0) {
      qb = qb.andWhere(
        new Brackets((qb) => {
          filters.dateRanges!.forEach((range, index) => {
            const condition =
              'ph."createdAt" BETWEEN :fromDate' +
              index +
              ' AND :toDate' +
              index;
            const params = {
              [`fromDate${index}`]: range.from,
              [`toDate${index}`]: range.to,
            };

            if (index === 0) {
              qb.where(condition, params);
            } else {
              qb.orWhere(condition, params);
            }
          });
        }),
      );
    }

    // Payment method group filtering
    if (filters.paymentMethodGroups && filters.paymentMethodGroups.length > 0) {
      qb = qb.andWhere(
        new Brackets((qb) => {
          filters.paymentMethodGroups!.forEach((methodGroup, index) => {
            if (index === 0) {
              qb.where('ph."paymentMethod" IN (:...methodGroup0)', {
                methodGroup0: methodGroup,
              });
            } else {
              qb.orWhere(`ph."paymentMethod" IN (:...methodGroup${index})`, {
                [`methodGroup${index}`]: methodGroup,
              });
            }
          });
        }),
      );
    }

    // Apply sorting, pagination, and caching
    qb = qb
      .orderBy(`ph."${sortBy}"`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit)
      .cache(30000); // Cache for 30 seconds

    return qb.getManyAndCount();
  }
}
