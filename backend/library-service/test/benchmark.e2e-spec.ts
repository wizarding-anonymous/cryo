import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TestAppModule } from './test-app.module';
import { BenchmarkService, BenchmarkSuite } from '../src/performance/benchmark.service';
import { PerformanceMonitorService } from '../src/performance/performance-monitor.service';
import { CacheService } from '../src/cache/cache.service';
import { LibraryGame } from '../src/entities/library-game.entity';
import { PurchaseHistory } from '../src/entities/purchase-history.entity';

describe('Benchmark E2E', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let benchmarkService: BenchmarkService;
    let performanceMonitor: PerformanceMonitorService;
    let cacheService: CacheService;

    beforeAll(async () => {
        try {
            const moduleFixture: TestingModule = await Test.createTestingModule({
                imports: [TestAppModule],
            }).compile();

            app = moduleFixture.createNestApplication();
            await app.init();

            dataSource = app.get(DataSource);
            benchmarkService = app.get(BenchmarkService);
            performanceMonitor = app.get(PerformanceMonitorService);
            cacheService = app.get(CacheService);

            // Clean up any existing test data
            await dataSource.getRepository(LibraryGame).delete({});
            await dataSource.getRepository(PurchaseHistory).delete({});
        } catch (error) {
            console.error('Failed to initialize benchmark test app:', error);
            throw error;
        }
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
    });

    beforeEach(async () => {
        // Clear cache statistics before each test
        cacheService.resetStats();
    });

    describe('Library Service Benchmark Suite', () => {
        it('should run comprehensive library benchmark with small dataset', async () => {
            const suite = await benchmarkService.runLibraryBenchmarkSuite({
                userCount: 5,
                gamesPerUser: 50,
                iterations: 3,
            });

            expect(suite).toBeDefined();
            expect(suite.name).toBe('Library Service Benchmark Suite');
            expect(suite.results).toHaveLength(6); // 6 different benchmark operations
            expect(suite.totalDuration).toBeGreaterThan(0);
            expect(suite.averageThroughput).toBeGreaterThan(0);

            // Log results for analysis
            console.log('\n=== Small Dataset Benchmark Results ===');
            console.log(`Total Duration: ${suite.totalDuration}ms`);
            console.log(`Average Throughput: ${suite.averageThroughput.toFixed(2)} ops/sec`);
            console.log(`Memory Delta: ${(suite.memoryDelta / 1024 / 1024).toFixed(2)}MB`);

            suite.results.forEach(result => {
                console.log(`\n${result.operation}:`);
                console.log(`  Duration: ${result.duration}ms`);
                console.log(`  Records: ${result.recordsProcessed}`);
                console.log(`  Throughput: ${result.throughput.toFixed(2)} ops/sec`);
                console.log(`  Success: ${result.success}`);
                if (result.error) {
                    console.log(`  Error: ${result.error}`);
                }
            });

            // Verify all operations succeeded
            suite.results.forEach(result => {
                expect(result.success).toBe(true);
                expect(result.duration).toBeGreaterThan(0);
                expect(result.throughput).toBeGreaterThan(0);
            });
        }, 60000);

        it('should run comprehensive library benchmark with medium dataset', async () => {
            const suite = await benchmarkService.runLibraryBenchmarkSuite({
                userCount: 10,
                gamesPerUser: 100,
                iterations: 5,
            });

            expect(suite).toBeDefined();
            expect(suite.results).toHaveLength(6);

            // Log results for analysis
            console.log('\n=== Medium Dataset Benchmark Results ===');
            console.log(`Total Duration: ${suite.totalDuration}ms`);
            console.log(`Average Throughput: ${suite.averageThroughput.toFixed(2)} ops/sec`);
            console.log(`Memory Delta: ${(suite.memoryDelta / 1024 / 1024).toFixed(2)}MB`);

            // Performance assertions for medium dataset
            expect(suite.totalDuration).toBeLessThan(120000); // Should complete within 2 minutes
            expect(suite.averageThroughput).toBeGreaterThan(10); // At least 10 ops/sec average

            // Memory usage should be reasonable
            expect(suite.memoryDelta).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase

            suite.results.forEach(result => {
                expect(result.success).toBe(true);

                // Specific performance requirements
                switch (result.operation) {
                    case 'Library Retrieval':
                        expect(result.throughput).toBeGreaterThan(50); // At least 50 retrievals/sec
                        break;
                    case 'Search Operations':
                        expect(result.throughput).toBeGreaterThan(20); // At least 20 searches/sec
                        break;
                    case 'Ownership Checks':
                        expect(result.throughput).toBeGreaterThan(100); // At least 100 checks/sec
                        break;
                    case 'Cache Operations':
                        expect(result.throughput).toBeGreaterThan(200); // At least 200 cache ops/sec
                        break;
                }
            });
        }, 180000);

        it('should benchmark database queries performance', async () => {
            // First, create some test data
            await benchmarkService.runLibraryBenchmarkSuite({
                userCount: 5,
                gamesPerUser: 100,
                iterations: 1,
            });

            const results = await benchmarkService.benchmarkDatabaseQueries();

            expect(results).toHaveLength(4); // 4 different query types

            console.log('\n=== Database Query Benchmark Results ===');
            results.forEach(result => {
                console.log(`\n${result.operation}:`);
                console.log(`  Duration: ${result.duration}ms`);
                console.log(`  Records: ${result.recordsProcessed}`);
                console.log(`  Throughput: ${result.throughput.toFixed(2)} ops/sec`);
                console.log(`  Success: ${result.success}`);

                expect(result.success).toBe(true);
                expect(result.duration).toBeGreaterThan(0);
                expect(result.throughput).toBeGreaterThan(0);
            });

            // Specific performance requirements for database queries
            const simpleQueries = results.find(r => r.operation === 'Simple Queries');
            if (simpleQueries) {
                expect(simpleQueries.throughput).toBeGreaterThan(100); // Simple queries should be fast
            }

            const complexQueries = results.find(r => r.operation === 'Complex Queries');
            if (complexQueries) {
                expect(complexQueries.throughput).toBeGreaterThan(10); // Complex queries can be slower
            }
        }, 120000);

        it('should benchmark cache performance', async () => {
            const results = await benchmarkService.benchmarkCachePerformance();

            expect(results).toHaveLength(3); // 3 different cache operations

            console.log('\n=== Cache Performance Benchmark Results ===');
            results.forEach(result => {
                console.log(`\n${result.operation}:`);
                console.log(`  Duration: ${result.duration}ms`);
                console.log(`  Records: ${result.recordsProcessed}`);
                console.log(`  Throughput: ${result.throughput.toFixed(2)} ops/sec`);
                console.log(`  Success: ${result.success}`);

                expect(result.success).toBe(true);
                expect(result.duration).toBeGreaterThan(0);
                expect(result.throughput).toBeGreaterThan(0);
            });

            // Cache operations should be very fast
            results.forEach(result => {
                expect(result.throughput).toBeGreaterThan(100); // At least 100 cache ops/sec
            });

            // Cache writes should be faster than reads (no network roundtrip for local cache)
            const writes = results.find(r => r.operation === 'Cache Writes');
            const reads = results.find(r => r.operation === 'Cache Reads');

            if (writes && reads) {
                // Both should be fast, but we don't enforce writes > reads as Redis might be optimized differently
                expect(writes.throughput).toBeGreaterThan(50);
                expect(reads.throughput).toBeGreaterThan(50);
            }
        }, 60000);
    });

    describe('Performance Monitoring Integration', () => {
        it('should collect performance metrics during benchmark', async () => {
            const initialMetrics = await performanceMonitor.getSystemMetrics();
            expect(initialMetrics).toBeDefined();
            expect(initialMetrics.memoryUsage).toBeDefined();
            expect(initialMetrics.cpuUsage).toBeGreaterThanOrEqual(0);

            // Run a small benchmark to generate some metrics
            await benchmarkService.runLibraryBenchmarkSuite({
                userCount: 2,
                gamesPerUser: 20,
                iterations: 2,
            });

            const finalMetrics = await performanceMonitor.getSystemMetrics();
            expect(finalMetrics).toBeDefined();

            // Memory usage should have increased during the benchmark
            expect(finalMetrics.memoryUsage.heapUsed).toBeGreaterThanOrEqual(initialMetrics.memoryUsage.heapUsed);

            console.log('\n=== Performance Metrics ===');
            console.log(`Initial Memory: ${(initialMetrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
            console.log(`Final Memory: ${(finalMetrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
            console.log(`Memory Increase: ${((finalMetrics.memoryUsage.heapUsed - initialMetrics.memoryUsage.heapUsed) / 1024 / 1024).toFixed(2)}MB`);
        }, 60000);

        it('should generate performance health check', async () => {
            const healthCheck = await performanceMonitor.performHealthCheck();

            expect(healthCheck).toBeDefined();
            expect(healthCheck.status).toMatch(/^(healthy|warning|critical)$/);
            expect(healthCheck.issues).toBeInstanceOf(Array);
            expect(healthCheck.metrics).toBeDefined();
            expect(healthCheck.metrics.responseTime).toBeGreaterThanOrEqual(0);
            expect(healthCheck.metrics.errorRate).toBeGreaterThanOrEqual(0);
            expect(healthCheck.metrics.memoryUsage).toBeGreaterThanOrEqual(0);

            console.log('\n=== Performance Health Check ===');
            console.log(`Status: ${healthCheck.status}`);
            console.log(`Issues: ${healthCheck.issues.length}`);
            if (healthCheck.issues.length > 0) {
                healthCheck.issues.forEach(issue => console.log(`  - ${issue}`));
            }
            console.log(`Response Time: ${healthCheck.metrics.responseTime}ms`);
            console.log(`Error Rate: ${(healthCheck.metrics.errorRate * 100).toFixed(2)}%`);
            console.log(`Memory Usage: ${healthCheck.metrics.memoryUsage.toFixed(1)}%`);
            console.log(`CPU Usage: ${healthCheck.metrics.cpuUsage.toFixed(1)}%`);
        });

        it('should provide performance summary', async () => {
            // Generate some request metrics first
            for (let i = 0; i < 10; i++) {
                performanceMonitor.recordRequestMetrics({
                    endpoint: '/library/my',
                    method: 'GET',
                    responseTime: Math.random() * 200 + 50, // 50-250ms
                    statusCode: 200,
                    userId: `user-${i}`,
                });
            }

            const summary = performanceMonitor.getPerformanceSummary(1); // Last 1 minute

            expect(summary).toBeDefined();
            expect(summary.requestCount).toBeGreaterThanOrEqual(10);
            expect(summary.averageResponseTime).toBeGreaterThan(0);
            expect(summary.errorRate).toBeGreaterThanOrEqual(0);
            expect(summary.slowRequestCount).toBeGreaterThanOrEqual(0);
            expect(summary.topSlowEndpoints).toBeInstanceOf(Array);
            expect(summary.statusCodeDistribution).toBeDefined();

            console.log('\n=== Performance Summary ===');
            console.log(`Request Count: ${summary.requestCount}`);
            console.log(`Average Response Time: ${summary.averageResponseTime}ms`);
            console.log(`Error Rate: ${(summary.errorRate * 100).toFixed(2)}%`);
            console.log(`Slow Requests: ${summary.slowRequestCount}`);
            console.log(`Status Codes:`, summary.statusCodeDistribution);
        });
    });

    describe('Stress Testing', () => {
        it('should handle high concurrency without degradation', async () => {
            const concurrentOperations = 20;
            const operationsPerConcurrency = 10;

            const startTime = Date.now();
            const promises: Promise<any>[] = [];

            // Create concurrent benchmark operations
            for (let i = 0; i < concurrentOperations; i++) {
                promises.push(
                    benchmarkService.runLibraryBenchmarkSuite({
                        userCount: 2,
                        gamesPerUser: operationsPerConcurrency,
                        iterations: 1,
                    })
                );
            }

            const results = await Promise.all(promises);
            const totalTime = Date.now() - startTime;

            console.log('\n=== Concurrency Stress Test Results ===');
            console.log(`Concurrent Operations: ${concurrentOperations}`);
            console.log(`Total Time: ${totalTime}ms`);
            console.log(`Average Time per Operation: ${(totalTime / concurrentOperations).toFixed(2)}ms`);

            // All operations should succeed
            results.forEach((suite, index) => {
                expect(suite).toBeDefined();
                expect(suite.results.every((r: any) => r.success)).toBe(true);

                if (index === 0) {
                    console.log(`First operation throughput: ${suite.averageThroughput.toFixed(2)} ops/sec`);
                }
                if (index === results.length - 1) {
                    console.log(`Last operation throughput: ${suite.averageThroughput.toFixed(2)} ops/sec`);
                }
            });

            // Performance should not degrade significantly under concurrency
            const throughputs = results.map((suite: BenchmarkSuite) => suite.averageThroughput);
            const avgThroughput = throughputs.reduce((sum, t) => sum + t, 0) / throughputs.length;
            const minThroughput = Math.min(...throughputs);
            const maxThroughput = Math.max(...throughputs);

            console.log(`Throughput - Avg: ${avgThroughput.toFixed(2)}, Min: ${minThroughput.toFixed(2)}, Max: ${maxThroughput.toFixed(2)}`);

            // Variance should not be too high (performance should be consistent)
            const throughputVariance = (maxThroughput - minThroughput) / avgThroughput;
            expect(throughputVariance).toBeLessThan(0.5); // Less than 50% variance
        }, 300000); // 5 minute timeout for stress test

        it('should maintain performance with large dataset', async () => {
            const suite = await benchmarkService.runLibraryBenchmarkSuite({
                userCount: 20,
                gamesPerUser: 200,
                iterations: 3,
            });

            expect(suite).toBeDefined();
            expect(suite.results.every(r => r.success)).toBe(true);

            console.log('\n=== Large Dataset Performance Test ===');
            console.log(`Total Users: 20`);
            console.log(`Games per User: 200`);
            console.log(`Total Records: ~4000`);
            console.log(`Total Duration: ${suite.totalDuration}ms`);
            console.log(`Average Throughput: ${suite.averageThroughput.toFixed(2)} ops/sec`);
            console.log(`Memory Delta: ${(suite.memoryDelta / 1024 / 1024).toFixed(2)}MB`);

            // Performance requirements for large dataset
            expect(suite.totalDuration).toBeLessThan(300000); // Should complete within 5 minutes
            expect(suite.averageThroughput).toBeGreaterThan(5); // At least 5 ops/sec average
            expect(suite.memoryDelta).toBeLessThan(200 * 1024 * 1024); // Less than 200MB increase

            // Individual operation performance
            suite.results.forEach(result => {
                console.log(`${result.operation}: ${result.throughput.toFixed(2)} ops/sec`);

                // Even with large dataset, operations should maintain minimum performance
                switch (result.operation) {
                    case 'Library Retrieval':
                        expect(result.throughput).toBeGreaterThan(20); // At least 20 retrievals/sec
                        break;
                    case 'Ownership Checks':
                        expect(result.throughput).toBeGreaterThan(50); // At least 50 checks/sec
                        break;
                    case 'Cache Operations':
                        expect(result.throughput).toBeGreaterThan(100); // Cache should remain fast
                        break;
                }
            });
        }, 360000); // 6 minute timeout for large dataset test
    });

    describe('Memory Leak Detection', () => {
        it('should not leak memory during repeated operations', async () => {
            const initialMemory = process.memoryUsage();

            // Run multiple benchmark cycles
            for (let i = 0; i < 5; i++) {
                await benchmarkService.runLibraryBenchmarkSuite({
                    userCount: 3,
                    gamesPerUser: 30,
                    iterations: 2,
                });

                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                }

                // Small delay between cycles
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

            console.log('\n=== Memory Leak Detection ===');
            console.log(`Initial Memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
            console.log(`Final Memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
            console.log(`Memory Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

            // Memory increase should be reasonable (less than 50MB after 5 cycles)
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
        }, 180000);
    });
});