import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics for detailed performance tracking
const libraryLoadTime = new Trend('library_load_time');
const searchResponseTime = new Trend('search_response_time');
const ownershipCheckTime = new Trend('ownership_check_time');
const historyLoadTime = new Trend('history_load_time');
const errorRate = new Rate('error_rate');
const cacheHitRate = new Rate('cache_hit_rate');
// const dbQueryCount = new Counter('db_query_count');

// Performance test scenarios
export const options = {
  scenarios: {
    // Scenario 1: Large library performance test
    large_library_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },   // Ramp up to 50 users
        { duration: '2m', target: 100 },   // Ramp to 100 users
        { duration: '3m', target: 200 },   // Peak at 200 users
        { duration: '2m', target: 100 },   // Ramp down
        { duration: '30s', target: 0 },    // Cool down
      ],
      tags: { test_type: 'large_library' },
    },
    
    // Scenario 2: Search performance under load
    search_performance: {
      executor: 'constant-vus',
      vus: 100,
      duration: '3m',
      tags: { test_type: 'search_performance' },
    },
    
    // Scenario 3: Concurrent ownership checks
    ownership_checks: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 20,
      maxDuration: '2m',
      tags: { test_type: 'ownership_checks' },
    },
    
    // Scenario 4: Mixed workload simulation
    mixed_workload: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { duration: '1m', target: 50 },    // 50 requests per second
        { duration: '2m', target: 100 },   // 100 requests per second
        { duration: '1m', target: 150 },   // 150 requests per second
        { duration: '1m', target: 50 },    // Back to 50
      ],
      tags: { test_type: 'mixed_workload' },
    },
  },
  
  thresholds: {
    // Performance requirements from spec
    'http_req_duration{test_type:large_library}': ['p(95)<200'],  // 95% under 200ms
    'http_req_duration{test_type:search_performance}': ['p(90)<500'], // 90% under 500ms
    'http_req_duration{test_type:ownership_checks}': ['p(95)<100'],   // 95% under 100ms
    'http_req_failed': ['rate<0.01'],                                 // <1% errors
    'library_load_time': ['p(95)<200'],                              // Library load under 200ms
    'search_response_time': ['p(90)<500'],                           // Search under 500ms
    'ownership_check_time': ['p(95)<100'],                           // Ownership check under 100ms
    'error_rate': ['rate<0.01'],                                     // <1% error rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';
// const REQUIRE_AUTH = (String(__ENV.REQUIRE_AUTH || 'true').toLowerCase() === 'true');
const COMMON_HEADERS = JWT_TOKEN
  ? { 
      Authorization: `Bearer ${JWT_TOKEN}`,
      'Content-Type': 'application/json'
    }
  : { 'Content-Type': 'application/json' };

// Test data generators
const generateGameIds = () => {
  const gameIds = [];
  for (let i = 1; i <= 1000; i++) {
    gameIds.push(`00000000-0000-0000-0000-${i.toString().padStart(12, '0')}`);
  }
  return gameIds;
};

const generateSearchQueries = () => [
  'Action',
  'RPG',
  'Strategy',
  'Adventure',
  'Simulation',
  'Puzzle',
  'Racing',
  'Sports',
  'Fighting',
  'Shooter',
  'The Elder Scrolls',
  'Call of Duty',
  'Grand Theft Auto',
  'Counter-Strike',
  'World of Warcraft',
  'Minecraft',
  'Fortnite',
  'League of Legends',
  'Dota 2',
  'Steam',
];

const gameIds = generateGameIds();
const searchQueries = generateSearchQueries();

export default function () {
  const scenario = __ENV.K6_SCENARIO_NAME || 'mixed_workload';
  
  switch (scenario) {
    case 'large_library_load':
      testLargeLibraryLoad();
      break;
    case 'search_performance':
      testSearchPerformance();
      break;
    case 'ownership_checks':
      testOwnershipChecks();
      break;
    default:
      testMixedWorkload();
  }
}

function testLargeLibraryLoad() {
  group('Large Library Load Test', () => {
    // Test library with different page sizes
    const pageSizes = [20, 50, 100];
    const pageSize = pageSizes[Math.floor(Math.random() * pageSizes.length)];
    const page = Math.floor(Math.random() * 10) + 1;
    
    const startTime = Date.now();
    const response = http.get(
      `${BASE_URL}/library/my?page=${page}&limit=${pageSize}&sortBy=purchaseDate&sortOrder=desc`,
      { headers: COMMON_HEADERS }
    );
    const endTime = Date.now();
    
    const responseTime = endTime - startTime;
    libraryLoadTime.add(responseTime);
    
    const success = check(response, {
      'library load status is 200': (r) => r.status === 200,
      'library load time < 200ms': () => responseTime < 200,
      'response has games array': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.games);
        } catch {
          return false;
        }
      },
      'response has pagination': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.pagination && typeof body.pagination.total === 'number';
        } catch {
          return false;
        }
      },
    });
    
    if (!success) {
      errorRate.add(1);
    } else {
      errorRate.add(0);
    }
    
    // Check for cache headers
    if (response.headers['X-Cache-Status']) {
      cacheHitRate.add(response.headers['X-Cache-Status'] === 'HIT' ? 1 : 0);
    }
    
    sleep(0.1);
  });
}

function testSearchPerformance() {
  group('Search Performance Test', () => {
    const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
    const page = Math.floor(Math.random() * 5) + 1;
    const limit = [10, 20, 50][Math.floor(Math.random() * 3)];
    
    const startTime = Date.now();
    const response = http.get(
      `${BASE_URL}/library/my/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
      { headers: COMMON_HEADERS }
    );
    const endTime = Date.now();
    
    const responseTime = endTime - startTime;
    searchResponseTime.add(responseTime);
    
    const success = check(response, {
      'search status is 200': (r) => r.status === 200,
      'search time < 500ms': () => responseTime < 500,
      'search has results structure': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.games !== undefined && body.pagination !== undefined;
        } catch {
          return false;
        }
      },
    });
    
    if (!success) {
      errorRate.add(1);
    } else {
      errorRate.add(0);
    }
    
    sleep(0.2);
  });
}

function testOwnershipChecks() {
  group('Ownership Check Test', () => {
    const gameId = gameIds[Math.floor(Math.random() * gameIds.length)];
    
    const startTime = Date.now();
    const response = http.get(
      `${BASE_URL}/library/ownership/${gameId}`,
      { headers: COMMON_HEADERS }
    );
    const endTime = Date.now();
    
    const responseTime = endTime - startTime;
    ownershipCheckTime.add(responseTime);
    
    const success = check(response, {
      'ownership check status is 200': (r) => r.status === 200,
      'ownership check time < 100ms': () => responseTime < 100,
      'ownership response has owns field': (r) => {
        try {
          const body = JSON.parse(r.body);
          return typeof body.owns === 'boolean';
        } catch {
          return false;
        }
      },
    });
    
    if (!success) {
      errorRate.add(1);
    } else {
      errorRate.add(0);
    }
    
    sleep(0.05);
  });
}

function testMixedWorkload() {
  const operations = [
    () => testLibraryOperation(),
    () => testSearchOperation(),
    () => testOwnershipOperation(),
    () => testHistoryOperation(),
  ];
  
  // Weighted random selection (library operations more frequent)
  const weights = [0.4, 0.3, 0.2, 0.1];
  const random = Math.random();
  let cumulativeWeight = 0;
  
  for (let i = 0; i < operations.length; i++) {
    cumulativeWeight += weights[i];
    if (random <= cumulativeWeight) {
      operations[i]();
      break;
    }
  }
}

function testLibraryOperation() {
  group('Mixed - Library Operation', () => {
    const params = new URLSearchParams({
      page: Math.floor(Math.random() * 5) + 1,
      limit: [20, 50][Math.floor(Math.random() * 2)],
      sortBy: ['purchaseDate', 'title', 'developer'][Math.floor(Math.random() * 3)],
      sortOrder: ['asc', 'desc'][Math.floor(Math.random() * 2)],
    });
    
    const response = http.get(`${BASE_URL}/library/my?${params}`, { headers: COMMON_HEADERS });
    
    check(response, {
      'mixed library status is 200': (r) => r.status === 200,
      'mixed library response time < 300ms': (r) => r.timings.duration < 300,
    });
    
    sleep(0.1);
  });
}

function testSearchOperation() {
  group('Mixed - Search Operation', () => {
    const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
    const response = http.get(
      `${BASE_URL}/library/my/search?query=${encodeURIComponent(query)}`,
      { headers: COMMON_HEADERS }
    );
    
    check(response, {
      'mixed search status is 200': (r) => r.status === 200,
      'mixed search response time < 600ms': (r) => r.timings.duration < 600,
    });
    
    sleep(0.2);
  });
}

function testOwnershipOperation() {
  group('Mixed - Ownership Operation', () => {
    const gameId = gameIds[Math.floor(Math.random() * 100)]; // Use first 100 games for higher hit rate
    const response = http.get(`${BASE_URL}/library/ownership/${gameId}`, { headers: COMMON_HEADERS });
    
    check(response, {
      'mixed ownership status is 200': (r) => r.status === 200,
      'mixed ownership response time < 150ms': (r) => r.timings.duration < 150,
    });
    
    sleep(0.05);
  });
}

function testHistoryOperation() {
  group('Mixed - History Operation', () => {
    const params = new URLSearchParams({
      page: Math.floor(Math.random() * 3) + 1,
      limit: [10, 20, 50][Math.floor(Math.random() * 3)],
    });
    
    const response = http.get(`${BASE_URL}/library/history?${params}`, { headers: COMMON_HEADERS });
    
    const responseTime = response.timings.duration;
    historyLoadTime.add(responseTime);
    
    check(response, {
      'mixed history status is 200': (r) => r.status === 200,
      'mixed history response time < 400ms': (r) => r.timings.duration < 400,
    });
    
    sleep(0.15);
  });
}

// Teardown function to log final metrics
export function teardown() {
  console.log('=== Performance Test Results ===');
  console.log(`Library Load Time P95: ${libraryLoadTime.values.p95}ms`);
  console.log(`Search Response Time P90: ${searchResponseTime.values.p90}ms`);
  console.log(`Ownership Check Time P95: ${ownershipCheckTime.values.p95}ms`);
  console.log(`History Load Time P95: ${historyLoadTime.values.p95}ms`);
  console.log(`Error Rate: ${(errorRate.rate * 100).toFixed(2)}%`);
  console.log(`Cache Hit Rate: ${(cacheHitRate.rate * 100).toFixed(2)}%`);
}