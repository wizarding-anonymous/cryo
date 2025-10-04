#!/usr/bin/env node

// Simple production database connection test
// This script tests the database connection using the same configuration as the application

const { DataSource } = require('typeorm');

// Load environment variables
require('dotenv').config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'postgres-catalog',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USER || 'catalog_service',
  password: process.env.POSTGRES_PASSWORD || 'catalog_password',
  database: process.env.POSTGRES_DB || 'catalog_db',
  logging: false,
});

async function testConnection() {
  console.log('🔍 Testing production database connection...');
  console.log(`📋 Connection details:`);
  console.log(`  Host: ${dataSource.options.host}`);
  console.log(`  Port: ${dataSource.options.port}`);
  console.log(`  Database: ${dataSource.options.database}`);
  console.log(`  User: ${dataSource.options.username}`);

  try {
    await dataSource.initialize();
    console.log('✅ Database connection successful!');
    
    // Test a simple query
    const result = await dataSource.query('SELECT version()');
    console.log(`📊 PostgreSQL version: ${result[0].version.split(' ')[0]} ${result[0].version.split(' ')[1]}`);
    
    // Check if migrations table exists
    try {
      const migrations = await dataSource.query('SELECT COUNT(*) as count FROM migrations');
      console.log(`📋 Executed migrations: ${migrations[0].count}`);
    } catch (error) {
      console.log('⚠️  Migrations table not found - please run migrations manually');
    }
    
    // Check if games table exists
    try {
      const games = await dataSource.query('SELECT COUNT(*) as count FROM games');
      console.log(`🎮 Games in catalog: ${games[0].count}`);
    } catch (error) {
      console.log('⚠️  Games table not found - please run migrations manually');
    }
    
    await dataSource.destroy();
    console.log('✅ Connection test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('💡 Please check:');
    console.log('  - Database server is running');
    console.log('  - Connection parameters are correct');
    console.log('  - Network connectivity');
    console.log('  - Firewall settings');
    process.exit(1);
  }
}

testConnection();