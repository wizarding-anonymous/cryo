#!/usr/bin/env node

// Redis connection test for production
// This script tests Redis connectivity using the same configuration as the application

const redis = require('redis');

// Load environment variables
require('dotenv').config();

const redisConfig = {
  socket: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    connectTimeout: 10000,
    reconnectStrategy: (retries) => Math.min(retries * 50, 500)
  },
  password: process.env.REDIS_PASSWORD || 'redis_password',
  database: parseInt(process.env.REDIS_DB || '0', 10),
};

async function testRedisConnection() {
  console.log('🔍 Testing Redis connection for Game Catalog Service...');
  console.log(`📋 Redis configuration:`);
  console.log(`  Host: ${redisConfig.host}`);
  console.log(`  Port: ${redisConfig.port}`);
  console.log(`  Database: ${redisConfig.db}`);
  console.log(`  Password: ${redisConfig.password ? '***' : 'none'}`);

  const client = redis.createClient(redisConfig);
  
  client.on('error', (err) => {
    console.error('❌ Redis Client Error:', err.message);
  });
  
  client.on('connect', () => {
    console.log('🔌 Redis client connected');
  });
  
  client.on('ready', () => {
    console.log('✅ Redis client ready');
  });

  try {
    // Test connection
    await client.connect();
    console.log('✅ Redis connection successful!');
    
    // Test basic operations
    const testKey = 'game-catalog:test:connection';
    const testValue = JSON.stringify({ 
      timestamp: Date.now(), 
      service: 'game-catalog-service',
      test: true 
    });
    
    // Set test value
    await client.setEx(testKey, 60, testValue);
    console.log('✅ Redis SET operation successful');
    
    // Get test value
    const retrievedValue = await client.get(testKey);
    if (retrievedValue === testValue) {
      console.log('✅ Redis GET operation successful');
    } else {
      console.log('⚠️  Redis GET operation returned unexpected value');
    }
    
    // Test cache key pattern
    const cacheKey = 'game-catalog:games:list:page:1:limit:20';
    const cacheValue = JSON.stringify({
      games: [{ id: 'test', title: 'Test Game' }],
      total: 1,
      cached_at: Date.now()
    });
    
    await client.setEx(cacheKey, 300, cacheValue);
    const cachedData = await client.get(cacheKey);
    
    if (cachedData) {
      console.log('✅ Cache pattern test successful');
      console.log(`📊 Cached data size: ${Buffer.byteLength(cachedData, 'utf8')} bytes`);
    }
    
    // Get Redis info
    const info = await client.info('memory');
    const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
    if (memoryMatch) {
      console.log(`📊 Redis memory usage: ${memoryMatch[1].trim()}`);
    }
    
    // Clean up test keys
    await client.del([testKey, cacheKey]);
    console.log('🧹 Test keys cleaned up');
    
    await client.disconnect();
    console.log('✅ Redis connection test completed successfully!');
    console.log('🚀 Game Catalog Service is ready to use Redis cache');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    console.log('💡 Please check:');
    console.log('  - Redis server is running');
    console.log('  - Connection parameters are correct');
    console.log('  - Network connectivity');
    console.log('  - Redis password is correct');
    console.log('  - Database number is available');
    
    try {
      await client.disconnect();
    } catch (disconnectError) {
      // Ignore disconnect errors
    }
    
    process.exit(1);
  }
}

testRedisConnection();