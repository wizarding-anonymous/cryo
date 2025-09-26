import { execSync } from 'child_process';
import { join } from 'path';

/**
 * Global setup for Jest tests
 * This runs once before all tests start
 */
export default async function globalSetup() {
  console.log('🚀 Starting global test setup...');

  try {
    // Start test database and Redis using Docker Compose
    console.log('📦 Starting test database and Redis containers...');
    
    const dockerComposeFile = join(__dirname, '..', 'docker-compose.test.yml');
    
    // Stop any existing test containers
    try {
      execSync(`docker-compose -f ${dockerComposeFile} down -v`, {
        stdio: 'pipe',
        timeout: 30000,
      });
    } catch (error) {
      // Ignore errors if containers don't exist
      console.log('ℹ️  No existing test containers to stop');
    }

    // Start fresh test containers
    execSync(`docker-compose -f ${dockerComposeFile} up -d`, {
      stdio: 'pipe',
      timeout: 60000,
    });

    // Wait for services to be ready
    console.log('⏳ Waiting for services to be ready...');
    await waitForServices();

    console.log('✅ Global test setup completed successfully');
  } catch (error) {
    console.error('❌ Global test setup failed:', error);
    throw error;
  }
}

/**
 * Wait for test services to be ready
 */
async function waitForServices(): Promise<void> {
  const maxAttempts = 30;
  const delay = 1000; // 1 second

  // Wait for PostgreSQL
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      execSync('docker exec notification-postgres-test pg_isready -U notification_test_user', {
        stdio: 'pipe',
        timeout: 5000,
      });
      console.log('✅ PostgreSQL is ready');
      break;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw new Error('PostgreSQL failed to start within timeout');
      }
      console.log(`⏳ Waiting for PostgreSQL... (attempt ${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Wait for Redis
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      execSync('docker exec notification-redis-test redis-cli ping', {
        stdio: 'pipe',
        timeout: 5000,
      });
      console.log('✅ Redis is ready');
      break;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw new Error('Redis failed to start within timeout');
      }
      console.log(`⏳ Waiting for Redis... (attempt ${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Wait for MailHog
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      execSync('curl -f http://localhost:8025/api/v1/messages', {
        stdio: 'pipe',
        timeout: 5000,
      });
      console.log('✅ MailHog is ready');
      break;
    } catch (error) {
      if (attempt === maxAttempts) {
        console.log('⚠️  MailHog not available, email tests may fail');
        break;
      }
      console.log(`⏳ Waiting for MailHog... (attempt ${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Additional wait to ensure all services are fully initialized
  console.log('⏳ Final initialization wait...');
  await new Promise(resolve => setTimeout(resolve, 2000));
}