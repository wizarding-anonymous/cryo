import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LibraryGame } from '../../entities/library-game.entity';

export interface LibraryQueryOptions {
  page?: number;
  limit?: number;
  sortBy?: 'purchaseDate' | 'purchasePrice' | 'createdAt';
  sortOrder?: 'ASC' | 'DESC';
  priceMin?: number;
  priceMax?: number;
  currency?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface SearchOptions extends LibraryQueryOptions {
  query: string;
  searchFields?: ('gameId' | 'orderId' | 'currency')[];
}

export interface LibraryStats {
  totalGames: number;
  totalSpent: number;
  averagePrice: number;
  oldestPurchase: Date;
  newestPurchase: Date;
  currencies: string[];
  currencyCount: number;
}

@Injectable()
export class OptimizedLibraryRepository {
  constructor(
    @InjectRepository(LibraryGame)
    private readonly libraryGameRepository: Repository<LibraryGame>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get user library with optimized pagination and sorting
   * Uses database-level pagination for better performance with large datasets
   */
  async findUserLibraryOptimized(
    userId: string,
    options: LibraryQueryOptions = {},
  ): Promise<{ games: LibraryGame[]; total: number }> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'purchaseDate',
      sortOrder = 'DESC',
      priceMin,
      priceMax,
      currency,
      dateFrom,
      dateTo,
    } = options;

    // Use stored procedure for better performance
    try {
      const result = await this.dataSource.query(
        `SELECT * FROM get_user_library_page($1, $2, $3, $4, $5)`,
        [userId, page, limit, sortBy, sortOrder],
      );

      if (result.length === 0) {
        return { games: [], total: 0 };
      }

      const total = parseInt(result[0].total_count, 10);
      const games = result.map((row: any) => {
        const game = new LibraryGame();
        game.id = row.id;
        game.userId = row.userId;
        game.gameId = row.gameId;
        game.purchaseDate = row.purchaseDate;
        game.purchasePrice = parseFloat(row.purchasePrice);
        game.currency = row.currency;
        game.orderId = row.orderId;
        game.purchaseId = row.purchaseId;
        game.createdAt = row.createdAt;
        game.updatedAt = row.updatedAt;
        return game;
      });

      return { games, total };
    } catch (error) {
      // Fallback to TypeORM query if stored procedure fails
      return this.findUserLibraryFallback(userId, options);
    }
  }

  /**
   * Search user library with full-text search optimization
   * Uses PostgreSQL full-text search capabilities
   */
  async searchUserLibraryOptimized(
    userId: string,
    options: SearchOptions,
  ): Promise<{ games: LibraryGame[]; total: number }> {
    const { query, page = 1, limit = 20 } = options;

    try {
      const result = await this.dataSource.query(
        `SELECT * FROM search_user_library($1, $2, $3, $4)`,
        [userId, query, page, limit],
      );

      if (result.length === 0) {
        return { games: [], total: 0 };
      }

      const total = parseInt(result[0].total_count, 10);
      const games = result.map((row: any) => {
        const game = new LibraryGame();
        game.id = row.id;
        game.userId = row.userId;
        game.gameId = row.gameId;
        game.purchaseDate = row.purchaseDate;
        game.purchasePrice = parseFloat(row.purchasePrice);
        game.currency = row.currency;
        game.orderId = row.orderId;
        game.purchaseId = row.purchaseId;
        game.createdAt = row.createdAt;
        game.updatedAt = row.updatedAt;
        return game;
      });

      return { games, total };
    } catch (error) {
      // Fallback to TypeORM query if stored procedure fails
      return this.searchUserLibraryFallback(userId, options);
    }
  }

  /**
   * Bulk add games to library for better performance during mass operations
   */
  async bulkAddGames(games: Partial<LibraryGame>[]): Promise<number> {
    if (games.length === 0) {
      return 0;
    }

    try {
      // Use stored procedure for bulk operations
      const gamesJson = JSON.stringify(games);
      const result = await this.dataSource.query(
        `SELECT bulk_add_library_games($1::jsonb)`,
        [gamesJson],
      );

      return result[0].bulk_add_library_games;
    } catch (error) {
      // Fallback to individual inserts
      return this.bulkAddGamesFallback(games);
    }
  }

  /**
   * Get user library statistics using materialized view
   */
  async getUserLibraryStats(userId: string): Promise<LibraryStats | null> {
    try {
      const result = await this.dataSource.query(
        `SELECT * FROM mv_user_library_stats WHERE "userId" = $1`,
        [userId],
      );

      if (result.length === 0) {
        return null;
      }

      const row = result[0];
      return {
        totalGames: parseInt(row.totalGames, 10),
        totalSpent: parseFloat(row.totalSpent),
        averagePrice: parseFloat(row.averagePrice),
        oldestPurchase: row.oldestPurchase,
        newestPurchase: row.newestPurchase,
        currencies: row.currencies,
        currencyCount: parseInt(row.currencyCount, 10),
      };
    } catch (error) {
      // Fallback to real-time calculation
      return this.calculateLibraryStatsFallback(userId);
    }
  }

  /**
   * Check if user owns a specific game (optimized for frequent calls)
   */
  async checkGameOwnership(userId: string, gameId: string): Promise<boolean> {
    // Use index-optimized query
    const result = await this.libraryGameRepository
      .createQueryBuilder('lg')
      .select('1')
      .where('lg.userId = :userId AND lg.gameId = :gameId', { userId, gameId })
      .limit(1)
      .getRawOne();

    return !!result;
  }

  /**
   * Get games by IDs for a user (optimized for batch operations)
   */
  async findGamesByIds(
    userId: string,
    gameIds: string[],
  ): Promise<LibraryGame[]> {
    if (gameIds.length === 0) {
      return [];
    }

    return this.libraryGameRepository
      .createQueryBuilder('lg')
      .where('lg.userId = :userId', { userId })
      .andWhere('lg.gameId IN (:...gameIds)', { gameIds })
      .orderBy('lg.purchaseDate', 'DESC')
      .getMany();
  }

  /**
   * Get recent purchases for a user (optimized with partial index)
   */
  async findRecentPurchases(
    userId: string,
    days: number = 30,
    limit: number = 10,
  ): Promise<LibraryGame[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.libraryGameRepository
      .createQueryBuilder('lg')
      .where('lg.userId = :userId', { userId })
      .andWhere('lg.purchaseDate >= :cutoffDate', { cutoffDate })
      .orderBy('lg.purchaseDate', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * Count games by currency for a user
   */
  async countGamesByCurrency(userId: string): Promise<Record<string, number>> {
    const result = await this.libraryGameRepository
      .createQueryBuilder('lg')
      .select('lg.currency', 'currency')
      .addSelect('COUNT(*)', 'count')
      .where('lg.userId = :userId', { userId })
      .groupBy('lg.currency')
      .getRawMany();

    return result.reduce(
      (acc, row) => {
        acc[row.currency] = parseInt(row.count, 10);
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  /**
   * Get price statistics for a user's library
   */
  async getPriceStatistics(userId: string): Promise<{
    min: number;
    max: number;
    avg: number;
    total: number;
  }> {
    const result = await this.libraryGameRepository
      .createQueryBuilder('lg')
      .select('MIN(lg.purchasePrice)', 'min')
      .addSelect('MAX(lg.purchasePrice)', 'max')
      .addSelect('AVG(lg.purchasePrice)', 'avg')
      .addSelect('SUM(lg.purchasePrice)', 'total')
      .where('lg.userId = :userId', { userId })
      .getRawOne();

    return {
      min: parseFloat(result.min) || 0,
      max: parseFloat(result.max) || 0,
      avg: parseFloat(result.avg) || 0,
      total: parseFloat(result.total) || 0,
    };
  }

  /**
   * Fallback method using TypeORM query builder
   */
  private async findUserLibraryFallback(
    userId: string,
    options: LibraryQueryOptions,
  ): Promise<{ games: LibraryGame[]; total: number }> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'purchaseDate',
      sortOrder = 'DESC',
      priceMin,
      priceMax,
      currency,
      dateFrom,
      dateTo,
    } = options;

    const queryBuilder = this.libraryGameRepository
      .createQueryBuilder('lg')
      .where('lg.userId = :userId', { userId });

    // Apply filters
    if (priceMin !== undefined) {
      queryBuilder.andWhere('lg.purchasePrice >= :priceMin', { priceMin });
    }
    if (priceMax !== undefined) {
      queryBuilder.andWhere('lg.purchasePrice <= :priceMax', { priceMax });
    }
    if (currency) {
      queryBuilder.andWhere('lg.currency = :currency', { currency });
    }
    if (dateFrom) {
      queryBuilder.andWhere('lg.purchaseDate >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      queryBuilder.andWhere('lg.purchaseDate <= :dateTo', { dateTo });
    }

    // Apply sorting
    queryBuilder.orderBy(`lg.${sortBy}`, sortOrder);

    // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [games, total] = await queryBuilder.getManyAndCount();
    return { games, total };
  }

  /**
   * Fallback search method using TypeORM
   */
  private async searchUserLibraryFallback(
    userId: string,
    options: SearchOptions,
  ): Promise<{ games: LibraryGame[]; total: number }> {
    const { query, page = 1, limit = 20, searchFields } = options;

    const queryBuilder = this.libraryGameRepository
      .createQueryBuilder('lg')
      .where('lg.userId = :userId', { userId });

    // Build search conditions
    const searchConditions: string[] = [];
    const searchParams: Record<string, any> = { userId };

    const fieldsToSearch = searchFields || ['gameId', 'orderId', 'currency'];

    fieldsToSearch.forEach((field, index) => {
      const paramName = `search${index}`;
      searchConditions.push(`lg.${field}::text ILIKE :${paramName}`);
      searchParams[paramName] = `%${query}%`;
    });

    if (searchConditions.length > 0) {
      queryBuilder.andWhere(`(${searchConditions.join(' OR ')})`, searchParams);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.orderBy('lg.purchaseDate', 'DESC').skip(offset).take(limit);

    const [games, total] = await queryBuilder.getManyAndCount();
    return { games, total };
  }

  /**
   * Fallback bulk add method
   */
  private async bulkAddGamesFallback(
    games: Partial<LibraryGame>[],
  ): Promise<number> {
    let insertedCount = 0;

    // Use transaction for better performance
    await this.dataSource.transaction(async (manager) => {
      for (const gameData of games) {
        try {
          await manager
            .createQueryBuilder()
            .insert()
            .into(LibraryGame)
            .values(gameData)
            .orUpdate([
              'purchasePrice',
              'purchaseDate',
              'orderId',
              'purchaseId',
              'updatedAt',
            ])
            .execute();
          insertedCount++;
        } catch (error) {
          // Skip duplicates or invalid data
          continue;
        }
      }
    });

    return insertedCount;
  }

  /**
   * Fallback stats calculation method
   */
  private async calculateLibraryStatsFallback(
    userId: string,
  ): Promise<LibraryStats | null> {
    const games = await this.libraryGameRepository.find({
      where: { userId },
      select: ['purchasePrice', 'purchaseDate', 'currency'],
    });

    if (games.length === 0) {
      return null;
    }

    const totalSpent = games.reduce(
      (sum, game) => sum + Number(game.purchasePrice),
      0,
    );
    const averagePrice = totalSpent / games.length;
    const currencies = [...new Set(games.map((game) => game.currency))];
    const purchaseDates = games.map((game) => game.purchaseDate).sort();

    return {
      totalGames: games.length,
      totalSpent,
      averagePrice,
      oldestPurchase: purchaseDates[0],
      newestPurchase: purchaseDates[purchaseDates.length - 1],
      currencies,
      currencyCount: currencies.length,
    };
  }
}
