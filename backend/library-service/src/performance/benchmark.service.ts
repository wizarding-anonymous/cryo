import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LibraryGame } from '../entities/library-game.entity';
import { PurchaseHistory } from '../entities/purchase-history.entity';
import { CacheService } from '../cache/cache.service';
import { randomUUID } from 'crypto';

export interface BenchmarkResult {
  operation: string;
  duration: number;
  recordsProcessed: number;
  throughput: number; // records per second
  memoryUsage: NodeJS.MemoryUsage;
  success: boolean;
  error?: string;
}

export interface BenchmarkSuite {
  name: string;
  results: BenchmarkResult[];
  totalDuration: number;
  averageThroughput: number;
  memoryDelta: number;
}

@Injectable()
export class BenchmarkService {
  private readonly logger = new Logger(BenchmarkService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Run comprehensive benchmark suite for library operations
   */
  async runLibraryBenchmarkSuite(options: {
    userCount?: number;
    gamesPerUser?: number;
    iterations?: number;
  } = {}): Promise<BenchmarkSuite> {
    const { userCount = 10, gamesPerUser = 100, iterations = 5 } = options;
    
    this.logger.log(`Starting library benchmark suite: ${userCount} users, ${gamesPerUser} games per user, ${iterations} iterations`);
    
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();
    const results: BenchmarkResult[] = [];

    // Setup test data
    const testUsers = await this.setupTestUsers(userCount, gamesPerUser);

    try {
      // Benchmark library retrieval
      results.push(await this.benchmarkLibraryRetrieval(testUsers, iterations));
      
      // Benchmark search operations
      results.push(await this.benchmarkSearchOperations(testUsers, iterations));
      
      // Benchmark ownership checks
      results.push(await this.benchmarkOwnershipChecks(testUsers, iterations));
      
      // Benchmark pagination
      results.push(await this.benchmarkPagination(testUsers, iterations));
      
      // Benchmark bulk operations
      results.push(await this.benchmarkBulkOperations(testUsers, iterations));
      
      // Benchmark cache operations
      results.push(await this.benchmarkCacheOperations(testUsers, iterations));

    } finally {
      // Cleanup test data
      await this.cleanupTestUsers(testUsers);
    }

    const totalDuration = Date.now() - startTime;
    const finalMemory = process.memoryUsage();
    const memoryDelta = finalMemory.heapUsed - initialMemory.heapUsed;
    
    const averageThroughput = results.reduce((sum, r) => sum + r.throughput, 0) / results.length;

    return {
      name: 'Library Service Benchmark Suite',
      results,
      totalDuration,
      averageThroughput,
      memoryDelta,
    };
  }

  /**
   * Benchmark database query performance
   */
  async benchmarkDatabaseQueries(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    
    // Test simple queries
    results.push(await this.benchmarkSimpleQueries());
    
    // Test complex queries with JOINs
    results.push(await this.benchmarkComplexQueries());
    
    // Test aggregation queries
    results.push(await this.benchmarkAggregationQueries());
    
    // Test concurrent queries
    results.push(await this.benchmarkConcurrentQueries());
    
    return results;
  }

  /**
   * Benchmark cache performance
   */
  async benchmarkCachePerformance(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    
    // Test cache writes
    results.push(await this.benchmarkCacheWrites());
    
    // Test cache reads
    results.push(await this.benchmarkCacheReads());
    
    // Test cache invalidation
    results.push(await this.benchmarkCacheInvalidation());
    
    return results;
  }

  /**
   * Setup test users with library data
   */
  private async setupTestUsers(userCount: number, gamesPerUser: number): Promise<string[]> {
    const userIds: string[] = [];
    
    for (let i = 0; i < userCount; i++) {
      const userId = randomUUID();
      userIds.push(userId);
      
      // Create library games for user
      const games: Partial<LibraryGame>[] = [];
      for (let j = 0; j < gamesPerUser; j++) {
        games.push({
          userId,
          gameId: randomUUID(),
          orderId: randomUUID(),
          purchaseId: randomUUID(),
          purchasePrice: Math.random() * 60 + 10,
          currency: ['USD', 'EUR', 'GBP'][Math.floor(Math.random() * 3)],
          purchaseDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
        });
      }
      
      // Batch insert games
      await this.dataSource
        .createQueryBuilder()
        .insert()
        .into(LibraryGame)
        .values(games)
        .execute();
    }
    
    return userIds;
  }

  /**
   * Cleanup test users and their data
   */
  private async cleanupTestUsers(userIds: string[]): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .delete()
      .from(LibraryGame)
      .where('userId IN (:...userIds)', { userIds })
      .execute();
      
    await this.dataSource
      .createQueryBuilder()
      .delete()
      .from(PurchaseHistory)
      .where('userId IN (:...userIds)', { userIds })
      .execute();
  }

  /**
   * Benchmark library retrieval operations
   */
  private async benchmarkLibraryRetrieval(userIds: string[], iterations: number): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    let recordsProcessed = 0;
    let success = true;
    let error: string | undefined;

    try {
      for (let i = 0; i < iterations; i++) {
        for (const userId of userIds) {
          const games = await this.dataSource
            .getRepository(LibraryGame)
            .find({
              where: { userId },
              take: 20,
              order: { purchaseDate: 'DESC' },
            });
          recordsProcessed += games.length;
        }
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const duration = Date.now() - startTime;
    const throughput = recordsProcessed / (duration / 1000);

    return {
      operation: 'Library Retrieval',
      duration,
      recordsProcessed,
      throughput,
      memoryUsage: process.memoryUsage(),
      success,
      error,
    };
  }

  /**
   * Benchmark search operations
   */
  private async benchmarkSearchOperations(userIds: string[], iterations: number): Promise<BenchmarkResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    let success = true;
    let error: string | undefined;

    const searchTerms = ['Action', 'RPG', 'Strategy', 'Adventure', 'Simulation'];

    try {
      for (let i = 0; i < iterations; i++) {
        for (const userId of userIds) {
          const searchTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
          const games = await this.dataSource
            .getRepository(LibraryGame)
            .createQueryBuilder('lg')
            .where('lg.userId = :userId', { userId })
            .andWhere('lg.gameId::text ILIKE :search', { search: `%${searchTerm}%` })
            .take(20)
            .getMany();
          recordsProcessed += games.length;
        }
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const duration = Date.now() - startTime;
    const throughput = recordsProcessed / (duration / 1000);

    return {
      operation: 'Search Operations',
      duration,
      recordsProcessed,
      throughput,
      memoryUsage: process.memoryUsage(),
      success,
      error,
    };
  }

  /**
   * Benchmark ownership checks
   */
  private async benchmarkOwnershipChecks(userIds: string[], iterations: number): Promise<BenchmarkResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    let success = true;
    let error: string | undefined;

    try {
      for (let i = 0; i < iterations; i++) {
        for (const userId of userIds) {
          const gameId = randomUUID();
          const exists = await this.dataSource
            .getRepository(LibraryGame)
            .createQueryBuilder('lg')
            .select('1')
            .where('lg.userId = :userId AND lg.gameId = :gameId', { userId, gameId })
            .limit(1)
            .getRawOne();
          recordsProcessed += exists ? 1 : 0;
        }
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const duration = Date.now() - startTime;
    const throughput = recordsProcessed / (duration / 1000);

    return {
      operation: 'Ownership Checks',
      duration,
      recordsProcessed,
      throughput,
      memoryUsage: process.memoryUsage(),
      success,
      error,
    };
  }

  /**
   * Benchmark pagination performance
   */
  private async benchmarkPagination(userIds: string[], iterations: number): Promise<BenchmarkResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    let success = true;
    let error: string | undefined;

    try {
      for (let i = 0; i < iterations; i++) {
        for (const userId of userIds) {
          const page = Math.floor(Math.random() * 5) + 1;
          const limit = 20;
          const offset = (page - 1) * limit;
          
          const games = await this.dataSource
            .getRepository(LibraryGame)
            .find({
              where: { userId },
              skip: offset,
              take: limit,
              order: { purchaseDate: 'DESC' },
            });
          recordsProcessed += games.length;
        }
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const duration = Date.now() - startTime;
    const throughput = recordsProcessed / (duration / 1000);

    return {
      operation: 'Pagination',
      duration,
      recordsProcessed,
      throughput,
      memoryUsage: process.memoryUsage(),
      success,
      error,
    };
  }

  /**
   * Benchmark bulk operations
   */
  private async benchmarkBulkOperations(userIds: string[], iterations: number): Promise<BenchmarkResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    let success = true;
    let error: string | undefined;

    try {
      for (let i = 0; i < iterations; i++) {
        const userId = userIds[Math.floor(Math.random() * userIds.length)];
        const games: Partial<LibraryGame>[] = [];
        
        for (let j = 0; j < 10; j++) {
          games.push({
            userId,
            gameId: randomUUID(),
            orderId: randomUUID(),
            purchaseId: randomUUID(),
            purchasePrice: Math.random() * 60 + 10,
            currency: 'USD',
            purchaseDate: new Date(),
          });
        }
        
        await this.dataSource
          .createQueryBuilder()
          .insert()
          .into(LibraryGame)
          .values(games)
          .orIgnore()
          .execute();
          
        recordsProcessed += games.length;
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const duration = Date.now() - startTime;
    const throughput = recordsProcessed / (duration / 1000);

    return {
      operation: 'Bulk Operations',
      duration,
      recordsProcessed,
      throughput,
      memoryUsage: process.memoryUsage(),
      success,
      error,
    };
  }

  /**
   * Benchmark cache operations
   */
  private async benchmarkCacheOperations(userIds: string[], iterations: number): Promise<BenchmarkResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    let success = true;
    let error: string | undefined;

    try {
      for (let i = 0; i < iterations; i++) {
        for (const userId of userIds) {
          const cacheKey = `library:${userId}`;
          
          // Cache write
          await this.cacheService.set(cacheKey, { userId, games: [] }, 300);
          
          // Cache read
          const cached = await this.cacheService.get(cacheKey);
          if (cached) {
            recordsProcessed++;
          }
        }
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const duration = Date.now() - startTime;
    const throughput = recordsProcessed / (duration / 1000);

    return {
      operation: 'Cache Operations',
      duration,
      recordsProcessed,
      throughput,
      memoryUsage: process.memoryUsage(),
      success,
      error,
    };
  }

  /**
   * Benchmark simple database queries
   */
  private async benchmarkSimpleQueries(): Promise<BenchmarkResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    let success = true;
    let error: string | undefined;

    try {
      for (let i = 0; i < 100; i++) {
        const result = await this.dataSource.query('SELECT COUNT(*) FROM library_games');
        recordsProcessed += parseInt(result[0].count, 10);
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const duration = Date.now() - startTime;
    const throughput = recordsProcessed / (duration / 1000);

    return {
      operation: 'Simple Queries',
      duration,
      recordsProcessed,
      throughput,
      memoryUsage: process.memoryUsage(),
      success,
      error,
    };
  }

  /**
   * Benchmark complex queries with JOINs
   */
  private async benchmarkComplexQueries(): Promise<BenchmarkResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    let success = true;
    let error: string | undefined;

    try {
      for (let i = 0; i < 50; i++) {
        const result = await this.dataSource.query(`
          SELECT lg."userId", COUNT(*) as game_count, SUM(lg."purchasePrice") as total_spent
          FROM library_games lg
          GROUP BY lg."userId"
          HAVING COUNT(*) > 5
          ORDER BY total_spent DESC
          LIMIT 10
        `);
        recordsProcessed += result.length;
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const duration = Date.now() - startTime;
    const throughput = recordsProcessed / (duration / 1000);

    return {
      operation: 'Complex Queries',
      duration,
      recordsProcessed,
      throughput,
      memoryUsage: process.memoryUsage(),
      success,
      error,
    };
  }

  /**
   * Benchmark aggregation queries
   */
  private async benchmarkAggregationQueries(): Promise<BenchmarkResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    let success = true;
    let error: string | undefined;

    try {
      for (let i = 0; i < 30; i++) {
        const result = await this.dataSource.query(`
          SELECT 
            currency,
            COUNT(*) as game_count,
            AVG("purchasePrice") as avg_price,
            MIN("purchasePrice") as min_price,
            MAX("purchasePrice") as max_price
          FROM library_games
          GROUP BY currency
          ORDER BY game_count DESC
        `);
        recordsProcessed += result.length;
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const duration = Date.now() - startTime;
    const throughput = recordsProcessed / (duration / 1000);

    return {
      operation: 'Aggregation Queries',
      duration,
      recordsProcessed,
      throughput,
      memoryUsage: process.memoryUsage(),
      success,
      error,
    };
  }

  /**
   * Benchmark concurrent queries
   */
  private async benchmarkConcurrentQueries(): Promise<BenchmarkResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    let success = true;
    let error: string | undefined;

    try {
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          this.dataSource.query('SELECT COUNT(*) FROM library_games WHERE "purchasePrice" > $1', [Math.random() * 50])
        );
      }
      
      const results = await Promise.all(promises);
      recordsProcessed = results.reduce((sum, result) => sum + parseInt(result[0].count, 10), 0);
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const duration = Date.now() - startTime;
    const throughput = recordsProcessed / (duration / 1000);

    return {
      operation: 'Concurrent Queries',
      duration,
      recordsProcessed,
      throughput,
      memoryUsage: process.memoryUsage(),
      success,
      error,
    };
  }

  /**
   * Benchmark cache writes
   */
  private async benchmarkCacheWrites(): Promise<BenchmarkResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    let success = true;
    let error: string | undefined;

    try {
      for (let i = 0; i < 1000; i++) {
        const key = `benchmark:write:${i}`;
        const value = { id: i, data: `test data ${i}`, timestamp: Date.now() };
        await this.cacheService.set(key, value, 60);
        recordsProcessed++;
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const duration = Date.now() - startTime;
    const throughput = recordsProcessed / (duration / 1000);

    return {
      operation: 'Cache Writes',
      duration,
      recordsProcessed,
      throughput,
      memoryUsage: process.memoryUsage(),
      success,
      error,
    };
  }

  /**
   * Benchmark cache reads
   */
  private async benchmarkCacheReads(): Promise<BenchmarkResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    let success = true;
    let error: string | undefined;

    try {
      // First, populate cache
      for (let i = 0; i < 100; i++) {
        const key = `benchmark:read:${i}`;
        const value = { id: i, data: `test data ${i}` };
        await this.cacheService.set(key, value, 60);
      }

      // Then benchmark reads
      for (let i = 0; i < 1000; i++) {
        const key = `benchmark:read:${i % 100}`;
        const value = await this.cacheService.get(key);
        if (value) {
          recordsProcessed++;
        }
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const duration = Date.now() - startTime;
    const throughput = recordsProcessed / (duration / 1000);

    return {
      operation: 'Cache Reads',
      duration,
      recordsProcessed,
      throughput,
      memoryUsage: process.memoryUsage(),
      success,
      error,
    };
  }

  /**
   * Benchmark cache invalidation
   */
  private async benchmarkCacheInvalidation(): Promise<BenchmarkResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    let success = true;
    let error: string | undefined;

    try {
      // First, populate cache
      for (let i = 0; i < 500; i++) {
        const key = `benchmark:invalidate:${i}`;
        const value = { id: i, data: `test data ${i}` };
        await this.cacheService.set(key, value, 60);
      }

      // Then benchmark invalidation
      for (let i = 0; i < 500; i++) {
        const key = `benchmark:invalidate:${i}`;
        await this.cacheService.del(key);
        recordsProcessed++;
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const duration = Date.now() - startTime;
    const throughput = recordsProcessed / (duration / 1000);

    return {
      operation: 'Cache Invalidation',
      duration,
      recordsProcessed,
      throughput,
      memoryUsage: process.memoryUsage(),
      success,
      error,
    };
  }
}