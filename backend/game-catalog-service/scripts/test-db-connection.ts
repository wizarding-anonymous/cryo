#!/usr/bin/env ts-node

import 'reflect-metadata';
import * as dotenv from 'dotenv';
import AppDataSource from '../data-source';
import { DatabaseConnectionUtil } from '../src/database/database-connection.util';

// Load environment variables
dotenv.config();

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  
  try {
    // Initialize data source
    console.log('📡 Initializing database connection...');
    await AppDataSource.initialize();
    console.log('✅ Database connection initialized successfully');

    // Test connection
    console.log('🧪 Testing database connectivity...');
    const isHealthy = await DatabaseConnectionUtil.testConnection(AppDataSource);
    
    if (isHealthy) {
      console.log('✅ Database connection test passed');
    } else {
      console.log('❌ Database connection test failed');
      process.exit(1);
    }

    // Get connection status
    console.log('📊 Getting connection status...');
    const status = DatabaseConnectionUtil.getConnectionStatus(AppDataSource);
    console.log('Connection Status:', status);

    // Perform health check
    console.log('🏥 Performing health check...');
    const healthCheck = await DatabaseConnectionUtil.healthCheck(AppDataSource);
    console.log('Health Check Result:', healthCheck);

    // Test a simple query
    console.log('🔍 Testing database query...');
    const result = await AppDataSource.query('SELECT version()');
    console.log('PostgreSQL Version:', result[0].version);

    console.log('🎉 All database tests passed successfully!');

  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    process.exit(1);
  } finally {
    // Clean up
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('🧹 Database connection closed');
    }
  }
}

// Run the test
testDatabaseConnection().catch(console.error);