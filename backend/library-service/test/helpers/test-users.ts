/**
 * Test users helper for e2e tests
 * Uses real users created in user-service
 */

export interface TestUser {
  id: string;
  email: string;
  password: string;
  name: string;
}

export const TEST_USERS: Record<string, TestUser> = {
  USER1: {
    id: '04522cb0-baff-4419-a073-55d94cca24f4',
    email: 'test1@example.com',
    password: 'password123',
    name: 'Тестовый Пользователь 1',
  },
  USER2: {
    id: '4b166914-83f6-4d60-8efa-f0a66d525dd8',
    email: 'test2@example.com',
    password: 'testpass456',
    name: 'Тестовый Пользователь 2',
  },
  ADMIN: {
    id: '9b769851-d09b-4e29-bb02-41e08ca47d61',
    email: 'admin@example.com',
    password: 'admin2024',
    name: 'Администратор',
  },
};

/**
 * Get JWT token for a test user
 */
export async function getTestUserToken(user: TestUser): Promise<string> {
  const response = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to login user ${user.email}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Create a valid JWT token for testing
 */
export function createTestJWT(userId: string): string {
  // For testing purposes, we'll use a simple JWT structure
  // In real tests, you should get actual tokens from user-service
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ 
    sub: userId, 
    email: TEST_USERS.USER1.email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
  })).toString('base64url');
  
  // Note: This is a mock signature for testing
  // Real tests should use actual tokens from user-service
  const signature = 'mock-signature';
  
  return `${header}.${payload}.${signature}`;
}