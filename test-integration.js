// Simple integration test script
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const API_KEY = 'dev-portal-service-key-change-in-production';

async function testIntegration() {
  console.log('🚀 Starting integration tests...');
  
  try {
    // Test health endpoint
    console.log('📊 Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/api/v1/monitoring/integrations/health`);
    console.log('✅ Health endpoint working:', healthResponse.status);
    
    // Test developer profile endpoint (should return 404 for non-existent user)
    console.log('👨‍💻 Testing developer profile endpoint...');
    try {
      await axios.get(`${BASE_URL}/api/v1/developers/123e4567-e89b-12d3-a456-426614174000/basic-profile`, {
        headers: { 'X-API-Key': API_KEY }
      });
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ Developer profile endpoint working (404 as expected)');
      } else {
        console.log('❌ Unexpected error:', error.response?.status, error.message);
      }
    }
    
    // Test without API key (should return 401)
    console.log('🔐 Testing API key authentication...');
    try {
      await axios.get(`${BASE_URL}/api/v1/developers/123e4567-e89b-12d3-a456-426614174000/basic-profile`);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ API key authentication working (401 as expected)');
      } else {
        console.log('❌ Unexpected error:', error.response?.status, error.message);
      }
    }
    
    console.log('🎉 Integration tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    process.exit(1);
  }
}

testIntegration();