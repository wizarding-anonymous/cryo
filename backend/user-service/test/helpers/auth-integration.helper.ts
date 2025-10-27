import * as request from 'supertest';

export interface AuthTestUser {
  name: string;
  email: string;
  password: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export class AuthIntegrationHelper {
  private readonly authServiceUrl: string;

  constructor(authServiceUrl = 'http://localhost:3001') {
    this.authServiceUrl = authServiceUrl;
  }

  /**
   * Register a new user via Auth Service
   */
  async registerUser(user: AuthTestUser): Promise<any> {
    try {
      const response = await request(this.authServiceUrl)
        .post('/api/auth/register')
        .send(user)
        .expect(201);
      
      return response.body;
    } catch (error) {
      console.error('Failed to register user:', error.message);
      throw new Error(`Auth Service registration failed: ${error.message}`);
    }
  }

  /**
   * Login user and get tokens via Auth Service
   */
  async loginUser(email: string, password: string): Promise<AuthTokens> {
    try {
      const response = await request(this.authServiceUrl)
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);
      
      return {
        access_token: response.body.data.access_token,
        refresh_token: response.body.data.refresh_token,
      };
    } catch (error) {
      console.error('Failed to login user:', error.message);
      throw new Error(`Auth Service login failed: ${error.message}`);
    }
  }

  /**
   * Validate token via Auth Service
   */
  async validateToken(token: string): Promise<any> {
    try {
      const response = await request(this.authServiceUrl)
        .get('/api/auth/validate')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      return response.body.data;
    } catch (error) {
      console.error('Failed to validate token:', error.message);
      throw new Error(`Auth Service token validation failed: ${error.message}`);
    }
  }

  /**
   * Logout user via Auth Service
   */
  async logoutUser(token: string): Promise<void> {
    try {
      await request(this.authServiceUrl)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    } catch (error) {
      console.error('Failed to logout user:', error.message);
      throw new Error(`Auth Service logout failed: ${error.message}`);
    }
  }

  /**
   * Check if Auth Service is available
   */
  async isAuthServiceAvailable(): Promise<boolean> {
    try {
      await request(this.authServiceUrl)
        .get('/health')
        .expect(200);
      return true;
    } catch (error) {
      console.warn('Auth Service is not available:', error.message);
      return false;
    }
  }

  /**
   * Create a test user with unique email
   */
  createTestUser(prefix = 'test'): AuthTestUser {
    const timestamp = Date.now();
    return {
      name: `${prefix} User ${timestamp}`,
      email: `${prefix}-${timestamp}@example.com`,
      password: 'StrongPass123!',
    };
  }
}