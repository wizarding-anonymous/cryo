import 'dotenv/config';

// Increase Jest timeout for E2E tests
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
  // Wait a bit for services to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));
});

// Global test teardown
afterAll(async () => {
  // Clean up any global resources
  await new Promise(resolve => setTimeout(resolve, 500));
});