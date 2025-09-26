import { execSync } from 'child_process';
import { join } from 'path';

/**
 * Global teardown for Jest tests
 * This runs once after all tests complete
 */
export default async function globalTeardown() {
  console.log('🧹 Starting global test teardown...');

  try {
    const dockerComposeFile = join(__dirname, '..', 'docker-compose.test.yml');

    // Stop and remove test containers
    console.log('🛑 Stopping test containers...');
    execSync(`docker-compose -f ${dockerComposeFile} down -v --remove-orphans`, {
      stdio: 'pipe',
      timeout: 30000,
    });

    // Clean up any remaining test containers
    try {
      console.log('🧹 Cleaning up any remaining test containers...');
      execSync('docker container prune -f --filter "label=com.docker.compose.project=notification-service"', {
        stdio: 'pipe',
        timeout: 15000,
      });
    } catch (error) {
      // Ignore cleanup errors
      console.log('ℹ️  Container cleanup completed (some containers may not have existed)');
    }

    // Clean up test volumes
    try {
      console.log('🧹 Cleaning up test volumes...');
      execSync('docker volume prune -f --filter "label=com.docker.compose.project=notification-service"', {
        stdio: 'pipe',
        timeout: 15000,
      });
    } catch (error) {
      // Ignore cleanup errors
      console.log('ℹ️  Volume cleanup completed (some volumes may not have existed)');
    }

    // Clean up test networks
    try {
      console.log('🧹 Cleaning up test networks...');
      execSync('docker network prune -f', {
        stdio: 'pipe',
        timeout: 15000,
      });
    } catch (error) {
      // Ignore cleanup errors
      console.log('ℹ️  Network cleanup completed');
    }

    console.log('✅ Global test teardown completed successfully');
  } catch (error) {
    console.error('❌ Global test teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  }
}