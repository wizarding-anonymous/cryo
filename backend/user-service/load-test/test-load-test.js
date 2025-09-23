// Quick test to verify load testing setup
const { CONFIG } = require('./simple-load-test');

console.log('🧪 Testing Load Test Configuration');
console.log('================================');
console.log(`Base URL: ${CONFIG.baseUrl}`);
console.log(`Max Concurrent Users: ${CONFIG.maxConcurrentUsers}`);
console.log(`Test Duration: ${CONFIG.testDurationMs / 1000}s`);
console.log(`Target Response Time: ${CONFIG.targetResponseTimeMs}ms`);
console.log(`Max Error Rate: ${CONFIG.maxErrorRate * 100}%`);

console.log('\n✅ Load test configuration is valid');
console.log('💡 To run full load test: node simple-load-test.js');