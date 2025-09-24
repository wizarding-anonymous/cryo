import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Gauge } from 'k6/metrics';

// Database-specific performance metrics
const dbConnectionTime = new Trend('db_connection_time');
const queryExecutionTime = new Trend('query_execution_time');
// const concurrentConnections = new Gauge('concurrent_connections');
const deadlockRate = new Rate('deadlock_rate');
const connectionPoolUtilization = new Gauge('connection_pool_utilization');
const cacheEfficiency = new Rate('cache_efficiency');

export const options = {
  scenarios: {
    // Database connection pool stress test
    connection_pool_stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },   // Ramp up to 50 concurrent connections
        { duration: '1m', target: 100 },   // 100 connections
        { duration: '2m', target: 200 },   // 200 connections (stress test)
        { duration: '1m', target: 300 },   // 300 connections (overload test)
        { duration: '30s', target: 0 },    // Cool down
      ],
      tags: { test_type: 'connection_pool' },
    },
    
    // Complex query performance test
    complex_queries: {
      executor: 'constant-vus',
      vus: 50,
      duration: '3m',
      tags: { test_type: 'complex_queries' },
    },
    
    // Concurrent write operations test
    concurrent_writes: {
      executor: 'per-vu-iterations',
      vus: 20,
      iterations: 50,
      maxDuration: '5m',
      tags: { test_type: 'concurrent_writes' },
    },
    
    // Large dataset pagination test
    large_dataset_pagination: {
      executor: 'constant-arrival-rate',
      rate: 30,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 20,
      maxVUs: 50,
      tags: { test_type: 'pagination' },
    },
  },
  
  thresholds: {
    'http_req_duration{test_type:connection_pool}': ['p(95)<500'],
    'http_req_duration{test_type:complex_queries}': ['p(90)<1000'],
    'http_req_duration{test_type:concurrent_writes}': ['p(95)<2000'],
    'http_req_duration{test_type:pagination}': ['p(95)<300'],
    'http_req_failed': ['rate<0.02'], // Allow slightly higher error rate for stress testing
    'db_connection_time': ['p(95)<100'],
    'query_execution_time': ['p(90)<500'],
    'deadlock_rate': ['rate<0.001'], // Less than 0.1% deadlocks
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';
const COMMON_HEADERS = JWT_TOKEN
  ? { 
      Authorization: `Bearer ${JWT_TOKEN}`,
      'Content-Type': 'application/json'
    }
  : { 'Content-Type': 'application/json' };

export default function () {
  const scenario = __ENV.K6_SCENARIO_NAME || 'connection_pool_stress';
  
  switch (scenario) {
    case 'connection_pool_stress':
      testConnectionPoolStress();
      break;
    case 'complex_queries':
      testComplexQueries();
      break;
    case 'concurrent_writes':
      testConcurrentWrites();
      break;
    case 'large_dataset_pagination':
      testLargeDatasetPagination();
      break;
    default:
      testConnectionPoolStress();
  }
}

function testConnectionPoolStress() {
  group('Connection Pool Stress Test', () => {
    // Simulate multiple concurrent database operations
    const operations = [
      () => getLibrary(),
      () => searchLibrary(),
      () => checkOwnership(),
      () => getHistory(),
      () => getLibraryStats(),
    ];
    
    // Execute multiple operations concurrently to stress connection pool
    const promises = [];
    for (let i = 0; i < 3; i++) {
      const operation = operations[Math.floor(Math.random() * operations.length)];
      promises.push(operation());
    }
    
    // Wait for all operations to complete
    Promise.all(promises);
    
    sleep(0.1);
  });
}

function testComplexQueries() {
  group('Complex Query Performance Test', () => {
    // Test complex queries that stress the database
    const complexOperations = [
      () => testLibraryWithPurchaseStats(),
      () => testAdvancedSearch(),
      () => testHistoryWithAggregations(),
      () => testCrossTableJoins(),
    ];
    
    const operation = complexOperations[Math.floor(Math.random() * complexOperations.length)];
    operation();
    
    sleep(0.2);
  });
}

function testConcurrentWrites() {
  group('Concurrent Write Operations Test', () => {
    // Simulate adding games to library (write operations)
    const gameId = `test-game-${Math.random().toString(36).substring(2, 11)}`;
    const orderId = `order-${Math.random().toString(36).substring(2, 11)}`;
    const purchaseId = `purchase-${Math.random().toString(36).substring(2, 11)}`;
    
    const payload = {
      userId: `user-${Math.floor(Math.random() * 1000)}`,
      gameId: gameId,
      orderId: orderId,
      purchaseId: purchaseId,
      purchasePrice: Math.floor(Math.random() * 100) + 10,
      currency: ['USD', 'EUR', 'GBP'][Math.floor(Math.random() * 3)],
      purchaseDate: new Date().toISOString(),
    };
    
    const startTime = Date.now();
    const response = http.post(
      `${BASE_URL}/library/add`,
      JSON.stringify(payload),
      { headers: COMMON_HEADERS }
    );
    const endTime = Date.now();
    
    queryExecutionTime.add(endTime - startTime);
    
    check(response, {
      'write operation status is 201 or 409': (r) => r.status === 201 || r.status === 409,
      'write operation time < 2000ms': (r) => r.timings.duration < 2000,
    });
    
    // Check for deadlock indicators
    if (response.status === 409 && response.body.includes('deadlock')) {
      deadlockRate.add(1);
    } else {
      deadlockRate.add(0);
    }
    
    sleep(0.1);
  });
}

function testLargeDatasetPagination() {
  group('Large Dataset Pagination Test', () => {
    // Test pagination performance with large datasets
    const page = Math.floor(Math.random() * 100) + 1; // Test deep pagination
    const limit = [50, 100][Math.floor(Math.random() * 2)]; // Larger page sizes
    
    const startTime = Date.now();
    const response = http.get(
      `${BASE_URL}/library/my?page=${page}&limit=${limit}&sortBy=purchaseDate&sortOrder=desc`,
      { headers: COMMON_HEADERS }
    );
    const endTime = Date.now();
    
    queryExecutionTime.add(endTime - startTime);
    
    check(response, {
      'pagination status is 200': (r) => r.status === 200,
      'pagination time < 300ms': (r) => r.timings.duration < 300,
      'pagination returns data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.games !== undefined && body.pagination !== undefined;
        } catch {
          return false;
        }
      },
    });
    
    sleep(0.05);
  });
}

// Helper functions for different operations
function getLibrary() {
  const response = http.get(`${BASE_URL}/library/my?limit=20`, { headers: COMMON_HEADERS });
  return response;
}

function searchLibrary() {
  const queries = ['Action', 'RPG', 'Strategy', 'Adventure'];
  const query = queries[Math.floor(Math.random() * queries.length)];
  const response = http.get(
    `${BASE_URL}/library/my/search?query=${query}`,
    { headers: COMMON_HEADERS }
  );
  return response;
}

function checkOwnership() {
  const gameId = `00000000-0000-0000-0000-${Math.floor(Math.random() * 1000).toString().padStart(12, '0')}`;
  const response = http.get(`${BASE_URL}/library/ownership/${gameId}`, { headers: COMMON_HEADERS });
  return response;
}

function getHistory() {
  const response = http.get(`${BASE_URL}/library/history?limit=20`, { headers: COMMON_HEADERS });
  return response;
}

function getLibraryStats() {
  // This would be a custom endpoint for library statistics
  const response = http.get(`${BASE_URL}/library/stats`, { headers: COMMON_HEADERS });
  return response;
}

function testLibraryWithPurchaseStats() {
  // Test complex JOIN queries
  const response = http.get(
    `${BASE_URL}/library/my?includeStats=true&limit=50`,
    { headers: COMMON_HEADERS }
  );
  
  const responseTime = response.timings.duration;
  queryExecutionTime.add(responseTime);
  
  check(response, {
    'complex query status is 200': (r) => r.status === 200,
    'complex query time < 1000ms': (r) => r.timings.duration < 1000,
  });
}

function testAdvancedSearch() {
  // Test advanced search with multiple filters
  const params = new URLSearchParams({
    query: 'Action',
    priceMin: '10',
    priceMax: '60',
    dateFrom: '2023-01-01',
    dateTo: '2024-12-31',
    currency: 'USD',
    sortBy: 'purchaseDate',
    sortOrder: 'desc',
    limit: '30',
  });
  
  const response = http.get(
    `${BASE_URL}/library/my/search?${params}`,
    { headers: COMMON_HEADERS }
  );
  
  const responseTime = response.timings.duration;
  queryExecutionTime.add(responseTime);
  
  check(response, {
    'advanced search status is 200': (r) => r.status === 200,
    'advanced search time < 800ms': (r) => r.timings.duration < 800,
  });
}

function testHistoryWithAggregations() {
  // Test purchase history with aggregations
  const response = http.get(
    `${BASE_URL}/library/history?includeAggregations=true&limit=50`,
    { headers: COMMON_HEADERS }
  );
  
  const responseTime = response.timings.duration;
  queryExecutionTime.add(responseTime);
  
  check(response, {
    'history aggregation status is 200': (r) => r.status === 200,
    'history aggregation time < 1200ms': (r) => r.timings.duration < 1200,
  });
}

function testCrossTableJoins() {
  // Test queries that join multiple tables
  const response = http.get(
    `${BASE_URL}/library/my?includeHistory=true&includePurchaseDetails=true&limit=25`,
    { headers: COMMON_HEADERS }
  );
  
  const responseTime = response.timings.duration;
  queryExecutionTime.add(responseTime);
  
  check(response, {
    'cross table join status is 200': (r) => r.status === 200,
    'cross table join time < 1500ms': (r) => r.timings.duration < 1500,
  });
}

export function teardown() {
  console.log('=== Database Stress Test Results ===');
  console.log(`DB Connection Time P95: ${dbConnectionTime.values.p95}ms`);
  console.log(`Query Execution Time P90: ${queryExecutionTime.values.p90}ms`);
  console.log(`Deadlock Rate: ${(deadlockRate.rate * 100).toFixed(3)}%`);
  console.log(`Connection Pool Utilization: ${connectionPoolUtilization.value}%`);
  console.log(`Cache Efficiency: ${(cacheEfficiency.rate * 100).toFixed(2)}%`);
}