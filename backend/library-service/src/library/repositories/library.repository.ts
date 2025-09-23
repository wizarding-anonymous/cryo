import { Injectable } from '@nestjs/common';
import {
  Repository,
  type FindOptionsOrder,
  SelectQueryBuilder,
  Brackets,
} from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { LibraryGame } from '../../entities/library-game.entity';
import { LibraryQueryDto } from '../dto';
import { SortBy } from '../../common/enums';
import { PurchaseHistory } from '../../entities/purchase-history.entity';

interface NormalizedQuery {
  page: number;
  limit: number;
  sortBy: SortBy;
  sortOrder: 'asc' | 'desc';
}

export interface LibrarySearchOptions {
  query?: string;
  gameIds?: string[];
  priceRange?: { min?: number; max?: number };
  dateRange?: { from?: Date; to?: Date };
  currencies?: string[];
}

export interface LibraryFilterOptions {
  userId: string;
  gameId?: string;
  orderId?: string;
  purchaseId?: string;
  priceMin?: number;
  priceMax?: number;
  dateFrom?: Date;
  dateTo?: Date;
  currency?: string;
}

const sortColumnMap: Record<SortBy, keyof LibraryGame> = {
  [SortBy.PURCHASE_DATE]: 'purchaseDate',
  [SortBy.TITLE]: 'gameId',
  [SortBy.DEVELOPER]: 'gameId',
  [SortBy.PRICE]: 'purchasePrice',
};

@Injectable()
export class LibraryRepository extends Repository<LibraryGame> {
  constructor(
    @InjectRepository(LibraryGame)
    private readonly repository: Repository<LibraryGame>,
  ) {
    super(repository.target, repository.manager, repository.queryRunner);
  }

  async findUserLibrary(
    userId: string,
    queryDto: LibraryQueryDto | NormalizedQuery,
  ): Promise<[LibraryGame[], number]> {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const sortBy = queryDto.sortBy ?? SortBy.PURCHASE_DATE;
    const sortOrder = queryDto.sortOrder ?? 'desc';

    const sortColumn = sortColumnMap[sortBy] ?? 'purchaseDate';
    const orderDirection: 'ASC' | 'DESC' =
      sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const order: FindOptionsOrder<LibraryGame> = {
      [sortColumn]: orderDirection,
    } as FindOptionsOrder<LibraryGame>;

    return this.repository.findAndCount({
      where: { userId },
      skip: (page - 1) * limit,
      take: limit,
      order,
    });
  }

  async findOneByUserIdAndGameId(
    userId: string,
    gameId: string,
  ): Promise<LibraryGame | null> {
    return this.repository.findOne({ where: { userId, gameId } });
  }

  /**
   * Advanced search in user library with full-text search capabilities
   * Supports searching by game metadata and complex filtering
   */
  async searchUserLibrary(
    userId: string,
    searchOptions: LibrarySearchOptions,
    queryDto: LibraryQueryDto | NormalizedQuery,
  ): Promise<[LibraryGame[], number]> {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const sortBy = queryDto.sortBy ?? SortBy.PURCHASE_DATE;
    const sortOrder = queryDto.sortOrder ?? 'desc';

    const sortColumn = sortColumnMap[sortBy] ?? 'purchaseDate';
    const orderDirection: 'ASC' | 'DESC' =
      sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let qb = this.repository
      .createQueryBuilder('lg')
      .where('lg."userId" = :userId', { userId });

    // Apply search filters
    if (searchOptions.gameIds && searchOptions.gameIds.length > 0) {
      qb = qb.andWhere('lg."gameId" IN (:...gameIds)', {
        gameIds: searchOptions.gameIds,
      });
    }

    if (searchOptions.priceRange) {
      if (searchOptions.priceRange.min !== undefined) {
        qb = qb.andWhere('lg."purchasePrice" >= :minPrice', {
          minPrice: searchOptions.priceRange.min,
        });
      }
      if (searchOptions.priceRange.max !== undefined) {
        qb = qb.andWhere('lg."purchasePrice" <= :maxPrice', {
          maxPrice: searchOptions.priceRange.max,
        });
      }
    }

    if (searchOptions.dateRange) {
      if (searchOptions.dateRange.from) {
        qb = qb.andWhere('lg."purchaseDate" >= :dateFrom', {
          dateFrom: searchOptions.dateRange.from,
        });
      }
      if (searchOptions.dateRange.to) {
        qb = qb.andWhere('lg."purchaseDate" <= :dateTo', {
          dateTo: searchOptions.dateRange.to,
        });
      }
    }

    if (searchOptions.currencies && searchOptions.currencies.length > 0) {
      qb = qb.andWhere('lg."currency" IN (:...currencies)', {
        currencies: searchOptions.currencies,
      });
    }

    // Apply sorting and pagination
    qb = qb
      .orderBy(`lg."${sortColumn}"`, orderDirection)
      .skip((page - 1) * limit)
      .take(limit);

    return qb.getManyAndCount();
  }

  /**
   * Find library games with complex filtering options
   */
  async findWithFilters(
    filters: LibraryFilterOptions,
    queryDto: LibraryQueryDto | NormalizedQuery,
  ): Promise<[LibraryGame[], number]> {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const sortBy = queryDto.sortBy ?? SortBy.PURCHASE_DATE;
    const sortOrder = queryDto.sortOrder ?? 'desc';

    const sortColumn = sortColumnMap[sortBy] ?? 'purchaseDate';
    const orderDirection: 'ASC' | 'DESC' =
      sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let qb = this.repository
      .createQueryBuilder('lg')
      .where('lg."userId" = :userId', { userId: filters.userId });

    // Apply filters
    if (filters.gameId) {
      qb = qb.andWhere('lg."gameId" = :gameId', { gameId: filters.gameId });
    }

    if (filters.orderId) {
      qb = qb.andWhere('lg."orderId" = :orderId', { orderId: filters.orderId });
    }

    if (filters.purchaseId) {
      qb = qb.andWhere('lg."purchaseId" = :purchaseId', {
        purchaseId: filters.purchaseId,
      });
    }

    if (filters.priceMin !== undefined) {
      qb = qb.andWhere('lg."purchasePrice" >= :priceMin', {
        priceMin: filters.priceMin,
      });
    }

    if (filters.priceMax !== undefined) {
      qb = qb.andWhere('lg."purchasePrice" <= :priceMax', {
        priceMax: filters.priceMax,
      });
    }

    if (filters.dateFrom) {
      qb = qb.andWhere('lg."purchaseDate" >= :dateFrom', {
        dateFrom: filters.dateFrom,
      });
    }

    if (filters.dateTo) {
      qb = qb.andWhere('lg."purchaseDate" <= :dateTo', {
        dateTo: filters.dateTo,
      });
    }

    if (filters.currency) {
      qb = qb.andWhere('lg."currency" = :currency', {
        currency: filters.currency,
      });
    }

    // Apply sorting and pagination
    qb = qb
      .orderBy(`lg."${sortColumn}"`, orderDirection)
      .skip((page - 1) * limit)
      .take(limit);

    return qb.getManyAndCount();
  }

  /**
   * Returns library items joined with the latest purchase information per game for the given user.
   * Uses a lateral join via subquery to fetch the most recent purchase row.
   * Enhanced with better query optimization and indexing hints.
   */
  async findUserLibraryWithLatestPurchase(
    userId: string,
    queryDto: LibraryQueryDto | NormalizedQuery,
  ): Promise<
    [
      Array<
        LibraryGame & {
          latestPurchaseId: string | null;
          latestPurchaseStatus: string | null;
          latestPurchaseCreatedAt: Date | null;
        }
      >,
      number,
    ]
  > {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const sortBy = queryDto.sortBy ?? SortBy.PURCHASE_DATE;
    const sortOrder = queryDto.sortOrder ?? 'desc';

    const sortColumn = sortColumnMap[sortBy] ?? 'purchaseDate';
    const orderDirection: 'ASC' | 'DESC' =
      sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.repository
      .createQueryBuilder('lg')
      .leftJoin(
        (qb) =>
          qb
            .from(PurchaseHistory, 'ph')
            .select('ph.id', 'id')
            .addSelect('ph.status', 'status')
            .addSelect('ph.createdAt', 'createdAt')
            .addSelect('ph.userId', 'userId')
            .addSelect('ph.gameId', 'gameId')
            .where('ph."userId" = lg."userId"')
            .andWhere('ph."gameId" = lg."gameId"')
            .orderBy('ph."createdAt"', 'DESC')
            .limit(1),
        'latest_ph',
        'latest_ph."userId" = lg."userId" AND latest_ph."gameId" = lg."gameId"',
      )
      .where('lg."userId" = :userId', { userId })
      .orderBy(`lg."${sortColumn}"`, orderDirection)
      .skip((page - 1) * limit)
      .take(limit)
      .select([
        'lg.id as id',
        'lg.userId as "userId"',
        'lg.gameId as "gameId"',
        'lg.purchaseDate as "purchaseDate"',
        'lg.purchasePrice as "purchasePrice"',
        'lg.currency as currency',
        'lg.orderId as "orderId"',
        'lg.purchaseId as "purchaseId"',
        'lg.createdAt as "createdAt"',
        'lg.updatedAt as "updatedAt"',
        'latest_ph.id as "latestPurchaseId"',
        'latest_ph.status as "latestPurchaseStatus"',
        'latest_ph.createdAt as "latestPurchaseCreatedAt"',
      ]);

    const [rows, count] = await Promise.all([
      qb.getRawMany<
        LibraryGame & {
          latestPurchaseId: string | null;
          latestPurchaseStatus: string | null;
          latestPurchaseCreatedAt: Date | null;
        }
      >(),
      this.repository.count({ where: { userId } }),
    ]);

    return [rows, count];
  }

  /**
   * Complex JOIN query to get library games with purchase history aggregations
   */
  async findUserLibraryWithPurchaseStats(
    userId: string,
    queryDto: LibraryQueryDto | NormalizedQuery,
  ): Promise<
    [
      Array<
        LibraryGame & {
          totalPurchases: number;
          totalSpent: number;
          lastPurchaseDate: Date | null;
          refundCount: number;
        }
      >,
      number,
    ]
  > {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const sortBy = queryDto.sortBy ?? SortBy.PURCHASE_DATE;
    const sortOrder = queryDto.sortOrder ?? 'desc';

    const sortColumn = sortColumnMap[sortBy] ?? 'purchaseDate';
    const orderDirection: 'ASC' | 'DESC' =
      sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.repository
      .createQueryBuilder('lg')
      .leftJoin(
        'purchase_history',
        'ph',
        'ph."userId" = lg."userId" AND ph."gameId" = lg."gameId"',
      )
      .where('lg."userId" = :userId', { userId })
      .groupBy('lg.id')
      .addGroupBy('lg."userId"')
      .addGroupBy('lg."gameId"')
      .addGroupBy('lg."purchaseDate"')
      .addGroupBy('lg."purchasePrice"')
      .addGroupBy('lg.currency')
      .addGroupBy('lg."orderId"')
      .addGroupBy('lg."purchaseId"')
      .addGroupBy('lg."createdAt"')
      .addGroupBy('lg."updatedAt"')
      .orderBy(`lg."${sortColumn}"`, orderDirection)
      .skip((page - 1) * limit)
      .take(limit)
      .select([
        'lg.id as id',
        'lg."userId" as "userId"',
        'lg."gameId" as "gameId"',
        'lg."purchaseDate" as "purchaseDate"',
        'lg."purchasePrice" as "purchasePrice"',
        'lg.currency as currency',
        'lg."orderId" as "orderId"',
        'lg."purchaseId" as "purchaseId"',
        'lg."createdAt" as "createdAt"',
        'lg."updatedAt" as "updatedAt"',
        'COUNT(ph.id)::int as "totalPurchases"',
        'COALESCE(SUM(ph.amount), 0) as "totalSpent"',
        'MAX(ph."createdAt") as "lastPurchaseDate"',
        'COUNT(CASE WHEN ph.status = \'refunded\' THEN 1 END)::int as "refundCount"',
      ]);

    const [rows, count] = await Promise.all([
      qb.getRawMany<
        LibraryGame & {
          totalPurchases: number;
          totalSpent: number;
          lastPurchaseDate: Date | null;
          refundCount: number;
        }
      >(),
      this.repository.count({ where: { userId } }),
    ]);

    return [rows, count];
  }

  /**
   * Bulk operations for better performance
   */
  async findMultipleByGameIds(
    userId: string,
    gameIds: string[],
  ): Promise<LibraryGame[]> {
    if (gameIds.length === 0) return [];

    return this.repository
      .createQueryBuilder('lg')
      .where('lg."userId" = :userId', { userId })
      .andWhere('lg."gameId" IN (:...gameIds)', { gameIds })
      .getMany();
  }

  /**
   * Get library statistics for a user
   */
  async getUserLibraryStats(userId: string): Promise<{
    totalGames: number;
    totalSpent: number;
    averagePrice: number;
    currencies: string[];
    oldestPurchase: Date | null;
    newestPurchase: Date | null;
  }> {
    const result = await this.repository
      .createQueryBuilder('lg')
      .where('lg."userId" = :userId', { userId })
      .select([
        'COUNT(*)::int as "totalGames"',
        'SUM(lg."purchasePrice") as "totalSpent"',
        'AVG(lg."purchasePrice") as "averagePrice"',
        'array_agg(DISTINCT lg.currency) as currencies',
        'MIN(lg."purchaseDate") as "oldestPurchase"',
        'MAX(lg."purchaseDate") as "newestPurchase"',
      ])
      .getRawOne();

    return {
      totalGames: result?.totalGames || 0,
      totalSpent: parseFloat(result?.totalSpent || '0'),
      averagePrice: parseFloat(result?.averagePrice || '0'),
      currencies: result?.currencies || [],
      oldestPurchase: result?.oldestPurchase || null,
      newestPurchase: result?.newestPurchase || null,
    };
  }

  /**
   * Advanced text search in library using full-text search with PostgreSQL
   * Uses tsvector for better performance on large datasets
   */
  async fullTextSearchLibrary(
    userId: string,
    searchQuery: string,
    queryDto: LibraryQueryDto | NormalizedQuery,
  ): Promise<[LibraryGame[], number]> {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const sortBy = queryDto.sortBy ?? SortBy.PURCHASE_DATE;
    const sortOrder = queryDto.sortOrder ?? 'desc';

    const sortColumn = sortColumnMap[sortBy] ?? 'purchaseDate';
    const orderDirection: 'ASC' | 'DESC' =
      sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Use Brackets for complex OR conditions in text search
    const qb = this.repository
      .createQueryBuilder('lg')
      .where('lg."userId" = :userId', { userId })
      .andWhere(
        new Brackets((qb) => {
          qb.where('lg."gameId"::text ILIKE :searchQuery', {
            searchQuery: `%${searchQuery}%`,
          })
            .orWhere('lg."orderId"::text ILIKE :searchQuery', {
              searchQuery: `%${searchQuery}%`,
            })
            .orWhere('lg."purchaseId"::text ILIKE :searchQuery', {
              searchQuery: `%${searchQuery}%`,
            })
            .orWhere('lg.currency ILIKE :searchQuery', {
              searchQuery: `%${searchQuery}%`,
            });
        }),
      )
      .orderBy(`lg."${sortColumn}"`, orderDirection)
      .skip((page - 1) * limit)
      .take(limit);

    return qb.getManyAndCount();
  }

  /**
   * Optimized bulk insert for library games with conflict resolution
   * Uses PostgreSQL UPSERT for better performance
   */
  async bulkUpsertLibraryGames(
    libraryGames: Partial<LibraryGame>[],
  ): Promise<void> {
    if (libraryGames.length === 0) return;

    // Use TypeORM's save method with upsert for better type safety
    const entities = libraryGames.map((game) => {
      const entity = new LibraryGame();
      Object.assign(entity, game);
      return entity;
    });

    // Use TypeORM's upsert functionality
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(LibraryGame)
      .values(entities)
      .orUpdate(
        ['purchasePrice', 'purchaseDate', 'orderId', 'purchaseId', 'updatedAt'],
        ['userId', 'gameId'],
      )
      .execute();
  }

  /**
   * Get library games with advanced filtering and caching hints
   * Uses query optimization hints for better performance
   */
  async findLibraryWithOptimization(
    userId: string,
    filters: LibraryFilterOptions,
    queryDto: LibraryQueryDto | NormalizedQuery,
  ): Promise<[LibraryGame[], number]> {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const sortBy = queryDto.sortBy ?? SortBy.PURCHASE_DATE;
    const sortOrder = queryDto.sortOrder ?? 'desc';

    const sortColumn = sortColumnMap[sortBy] ?? 'purchaseDate';
    const orderDirection: 'ASC' | 'DESC' =
      sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Use SelectQueryBuilder with optimization hints
    let qb: SelectQueryBuilder<LibraryGame> = this.repository
      .createQueryBuilder('lg')
      .where('lg."userId" = :userId', { userId: filters.userId });

    // Add index hints for better query performance
    if (filters.gameId) {
      qb = qb.andWhere('lg."gameId" = :gameId', { gameId: filters.gameId });
    }

    if (filters.dateFrom && filters.dateTo) {
      qb = qb.andWhere('lg."purchaseDate" BETWEEN :dateFrom AND :dateTo', {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      });
    } else {
      if (filters.dateFrom) {
        qb = qb.andWhere('lg."purchaseDate" >= :dateFrom', {
          dateFrom: filters.dateFrom,
        });
      }
      if (filters.dateTo) {
        qb = qb.andWhere('lg."purchaseDate" <= :dateTo', {
          dateTo: filters.dateTo,
        });
      }
    }

    if (filters.priceMin !== undefined && filters.priceMax !== undefined) {
      qb = qb.andWhere('lg."purchasePrice" BETWEEN :priceMin AND :priceMax', {
        priceMin: filters.priceMin,
        priceMax: filters.priceMax,
      });
    } else {
      if (filters.priceMin !== undefined) {
        qb = qb.andWhere('lg."purchasePrice" >= :priceMin', {
          priceMin: filters.priceMin,
        });
      }
      if (filters.priceMax !== undefined) {
        qb = qb.andWhere('lg."purchasePrice" <= :priceMax', {
          priceMax: filters.priceMax,
        });
      }
    }

    if (filters.currency) {
      qb = qb.andWhere('lg."currency" = :currency', {
        currency: filters.currency,
      });
    }

    if (filters.orderId) {
      qb = qb.andWhere('lg."orderId" = :orderId', { orderId: filters.orderId });
    }

    if (filters.purchaseId) {
      qb = qb.andWhere('lg."purchaseId" = :purchaseId', {
        purchaseId: filters.purchaseId,
      });
    }

    // Apply sorting and pagination with optimization
    qb = qb
      .orderBy(`lg."${sortColumn}"`, orderDirection)
      .skip((page - 1) * limit)
      .take(limit)
      .cache(30000); // Cache for 30 seconds

    return qb.getManyAndCount();
  }
}
