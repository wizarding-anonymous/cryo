#!/usr/bin/env ts-node

/**
 * Load Testing Script for User Service
 * Tests the performance of User Service endpoints
 */

import axios, { AxiosInstance } from 'axios';
import { performance } from 'perf_hooks';

interface LoadTestConfig {
  baseUrl: string;
  concurrentUsers: number;
  requestsPerUser: number;
  testDuration?: number; // in seconds
  endpoints: TestEndpoint[];
}

interface TestEndpoint {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  data?: any;
  headers?: Record<string, string>;
  weight: number; // probability weight
}

interface TestResult {
  endpoint: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errors: string[];
}

class LoadTester {
  private client: AxiosInstance;
  private results: Map<string, TestResult> = new Map();

  constructor(private config: LoadTestConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      validateStatus: () => true, // Don't throw on HTTP errors
    });
  }

  async runTest(): Promise<void> {
    console.log('🚀 Starting load test...');
    console.log(`📊 Configuration:`);
    console.log(`   - Base URL: ${this.config.baseUrl}`);
    console.log(`   - Concurrent Users: ${this.config.concurrentUsers}`);
    console.log(`   - Requests per User: ${this.config.requestsPerUser}`);
    console.log(`   - Test Duration: ${this.config.testDuration || 'N/A'} seconds`);
    console.log(`   - Endpoints: ${this.config.endpoints.length}`);
    console.log('');

    // Initialize results
    for (const endpoint of this.config.endpoints) {
      this.results.set(endpoint.name, {
        endpoint: endpoint.name,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        requestsPerSecond: 0,
        errors: [],
      });
    }

    const startTime = performance.now();

    // Create concurrent users
    const userPromises = Array.from({ length: this.config.concurrentUsers }, (_, i) =>
      this.simulateUser(i + 1)
    );

    // Wait for all users to complete
    await Promise.all(userPromises);

    const endTime = performance.now();
    const totalDuration = (endTime - startTime) / 1000;

    // Calculate final statistics
    this.calculateFinalStats(totalDuration);

    // Print results
    this.printResults(totalDuration);
  }

  private async simulateUser(userId: number): Promise<void> {
    const responseTimes: Map<string, number[]> = new Map();

    for (let i = 0; i < this.config.requestsPerUser; i++) {
      const endpoint = this.selectRandomEndpoint();
      const startTime = performance.now();

      try {
        const response = await this.client.request({
          method: endpoint.method,
          url: endpoint.path,
          data: endpoint.data,
          headers: endpoint.headers,
        });

        const endTime = performance.now();
        const responseTime = endTime - startTime;

        const result = this.results.get(endpoint.name)!;
        result.totalRequests++;

        if (response.status >= 200 && response.status < 400) {
          result.successfulRequests++;
        } else {
          result.failedRequests++;
          result.errors.push(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Track response times
        if (!responseTimes.has(endpoint.name)) {
          responseTimes.set(endpoint.name, []);
        }
        responseTimes.get(endpoint.name)!.push(responseTime);

        result.minResponseTime = Math.min(result.minResponseTime, responseTime);
        result.maxResponseTime = Math.max(result.maxResponseTime, responseTime);

      } catch (error) {
        const result = this.results.get(endpoint.name)!;
        result.totalRequests++;
        result.failedRequests++;
        result.errors.push(error instanceof Error ? error.message : String(error));
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Calculate average response times for this user
    for (const [endpointName, times] of responseTimes) {
      const result = this.results.get(endpointName)!;
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      result.averageResponseTime = (result.averageResponseTime + avgTime) / 2;
    }
  }

  private selectRandomEndpoint(): TestEndpoint {
    const totalWeight = this.config.endpoints.reduce((sum, ep) => sum + ep.weight, 0);
    let random = Math.random() * totalWeight;

    for (const endpoint of this.config.endpoints) {
      random -= endpoint.weight;
      if (random <= 0) {
        return endpoint;
      }
    }

    return this.config.endpoints[0]; // fallback
  }

  private calculateFinalStats(totalDuration: number): void {
    for (const result of this.results.values()) {
      if (result.totalRequests > 0) {
        result.requestsPerSecond = result.totalRequests / totalDuration;
      }
    }
  }

  private printResults(totalDuration: number): void {
    console.log('📊 Load Test Results');
    console.log('='.repeat(80));
    console.log(`Total Duration: ${totalDuration.toFixed(2)} seconds`);
    console.log('');

    let totalRequests = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;

    for (const result of this.results.values()) {
      totalRequests += result.totalRequests;
      totalSuccessful += result.successfulRequests;
      totalFailed += result.failedRequests;

      console.log(`🎯 ${result.endpoint}`);
      console.log(`   Total Requests: ${result.totalRequests}`);
      console.log(`   Successful: ${result.successfulRequests} (${((result.successfulRequests / result.totalRequests) * 100).toFixed(1)}%)`);
      console.log(`   Failed: ${result.failedRequests} (${((result.failedRequests / result.totalRequests) * 100).toFixed(1)}%)`);
      console.log(`   Avg Response Time: ${result.averageResponseTime.toFixed(2)}ms`);
      console.log(`   Min Response Time: ${result.minResponseTime === Infinity ? 'N/A' : result.minResponseTime.toFixed(2)}ms`);
      console.log(`   Max Response Time: ${result.maxResponseTime.toFixed(2)}ms`);
      console.log(`   Requests/sec: ${result.requestsPerSecond.toFixed(2)}`);

      if (result.errors.length > 0) {
        console.log(`   Errors (showing first 5):`);
        result.errors.slice(0, 5).forEach(error => {
          console.log(`     - ${error}`);
        });
      }
      console.log('');
    }

    console.log('📈 Overall Summary');
    console.log('-'.repeat(40));
    console.log(`Total Requests: ${totalRequests}`);
    console.log(`Successful: ${totalSuccessful} (${((totalSuccessful / totalRequests) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${totalFailed} (${((totalFailed / totalRequests) * 100).toFixed(1)}%)`);
    console.log(`Overall RPS: ${(totalRequests / totalDuration).toFixed(2)}`);
  }
}

// Default test configuration
const defaultConfig: LoadTestConfig = {
  baseUrl: 'http://localhost:3002',
  concurrentUsers: 10,
  requestsPerUser: 50,
  endpoints: [
    {
      name: 'Health Check',
      method: 'GET',
      path: '/health',
      weight: 1,
    },
    {
      name: 'Get User by ID',
      method: 'GET',
      path: '/users/550e8400-e29b-41d4-a716-446655440000', // Mock UUID
      weight: 3,
    },
    {
      name: 'Get User by Email',
      method: 'GET',
      path: '/users/email/test@example.com',
      weight: 2,
    },
    {
      name: 'Create User',
      method: 'POST',
      path: '/users',
      data: {
        email: `test-${Date.now()}@example.com`,
        password: 'hashedpassword123',
        name: 'Load Test User',
      },
      weight: 1,
    },
    {
      name: 'Update User Profile',
      method: 'PATCH',
      path: '/profiles/550e8400-e29b-41d4-a716-446655440000',
      data: {
        name: 'Updated Name',
        preferences: {
          theme: 'dark',
          language: 'en',
        },
      },
      weight: 1,
    },
    {
      name: 'Batch User Lookup',
      method: 'GET',
      path: '/batch/users/lookup?ids=550e8400-e29b-41d4-a716-446655440000,550e8400-e29b-41d4-a716-446655440001',
      weight: 2,
    },
  ],
};

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const config = { ...defaultConfig };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':
        config.baseUrl = args[++i];
        break;
      case '--users':
        config.concurrentUsers = parseInt(args[++i]);
        break;
      case '--requests':
        config.requestsPerUser = parseInt(args[++i]);
        break;
      case '--duration':
        config.testDuration = parseInt(args[++i]);
        break;
      case '--help':
        console.log(`
Load Testing Script for User Service

Usage: npm run perf:load-test [options]

Options:
  --url <url>           Base URL for the service (default: http://localhost:3002)
  --users <number>      Number of concurrent users (default: 10)
  --requests <number>   Requests per user (default: 50)
  --duration <seconds>  Test duration in seconds (optional)
  --help               Show this help message

Examples:
  npm run perf:load-test
  npm run perf:load-test -- --users 20 --requests 100
  npm run perf:load-test -- --url http://localhost:3002 --users 5
        `);
        process.exit(0);
    }
  }

  // Validate configuration
  if (config.concurrentUsers <= 0 || config.requestsPerUser <= 0) {
    console.error('❌ Users and requests must be positive numbers');
    process.exit(1);
  }

  try {
    // Test connection first
    console.log(`🔍 Testing connection to ${config.baseUrl}...`);
    const response = await axios.get(`${config.baseUrl}/health`, { timeout: 5000 });
    if (response.status !== 200) {
      console.error(`❌ Service not healthy: HTTP ${response.status}`);
      process.exit(1);
    }
    console.log('✅ Service is healthy, starting load test...\n');

    const tester = new LoadTester(config);
    await tester.runTest();

  } catch (error) {
    console.error('❌ Error running load test:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { LoadTester, LoadTestConfig };