#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { Game } from '../src/entities/game.entity';

// Load test environment
dotenv.config({ path: '.env.test' });

/**
 * Integration test runner script
 * This script sets up the test environment and runs all integration tests
 */
class IntegrationTestRunner {
  private testDataSource: DataSource;

  constructor() {
    this.testDataSource = new DataSource({
      type: 'postgres',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT, 10) || 5433,
      username: process.env.POSTGRES_USER || 'test_user',
      password: process.env.POSTGRES_PASSWORD || 'test_password',
      database: process.env.POSTGRES_DB || 'game_catalog_test_db',
      entities: [Game],
      synchronize: true,
      dropSchema: false,
      logging: false,
    });
  }

  /**
   * Check if test database is available
   */
  async checkDatabaseConnection(): Promise<boolean> {
    try {
      await this.testDataSource.initialize();
      console.log('✅ Test database connection successful');
      await this.testDataSource.destroy();
      return true;
    } catch (error) {
      console.error('❌ Test database connection failed:', error.message);
      return false;
    }
  }

  /**
   * Setup test database schema
   */
  async setupTestDatabase(): Promise<void> {
    try {
      await this.testDataSource.initialize();

      // Drop and recreate schema for clean tests
      await this.testDataSource.dropDatabase();
      await this.testDataSource.synchronize();

      console.log('✅ Test database schema created');
      await this.testDataSource.destroy();
    } catch (error) {
      console.error('❌ Failed to setup test database:', error.message);
      throw error;
    }
  }

  /**
   * Run specific test suite
   */
  runTestSuite(suiteName: string): void {
    try {
      console.log(`\n🧪 Running ${suiteName} tests...`);

      const command = `jest --config ./test/jest-e2e.json --testNamePattern="${suiteName}" --verbose`;
      execSync(command, {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log(`✅ ${suiteName} tests completed`);
    } catch (error) {
      console.error(`❌ ${suiteName} tests failed`);
      throw error;
    }
  }

  /**
   * Run all integration tests
   */
  runAllTests(): void {
    try {
      console.log('\n🧪 Running all integration and e2e tests...');

      const command = 'jest --config ./test/jest-e2e.json --verbose --coverage';
      execSync(command, {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: 'test' },
      });

      console.log('✅ All integration tests completed');
    } catch (error) {
      console.error('❌ Integration tests failed');
      throw error;
    }
  }

  /**
   * Clean up test environment
   */
  async cleanup(): Promise<void> {
    try {
      await this.testDataSource.initialize();
      await this.testDataSource.dropDatabase();
      await this.testDataSource.destroy();
      console.log('✅ Test environment cleaned up');
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error.message);
    }
  }

  /**
   * Main test runner
   */
  async run(): Promise<void> {
    console.log('🚀 Starting Integration Test Runner');
    console.log('=====================================');

    try {
      // Check prerequisites
      console.log('\n📋 Checking prerequisites...');

      const dbAvailable = await this.checkDatabaseConnection();
      if (!dbAvailable) {
        console.error('\n❌ Test database is not available. Please ensure:');
        console.error('   1. PostgreSQL is running');
        console.error('   2. Test database exists');
        console.error('   3. Connection parameters in .env.test are correct');
        process.exit(1);
      }

      // Setup test environment
      console.log('\n🔧 Setting up test environment...');
      await this.setupTestDatabase();

      // Run tests based on command line arguments
      const args = process.argv.slice(2);

      if (args.length === 0) {
        // Run all tests
        this.runAllTests();
      } else {
        // Run specific test suites
        for (const suite of args) {
          this.runTestSuite(suite);
        }
      }

      console.log('\n🎉 All tests completed successfully!');
    } catch (error) {
      console.error('\n💥 Test run failed:', error.message);
      process.exit(1);
    } finally {
      // Always cleanup
      await this.cleanup();
    }
  }
}

// Run the test runner if this script is executed directly
if (require.main === module) {
  const runner = new IntegrationTestRunner();
  runner.run().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { IntegrationTestRunner };
