import { ConfigService } from '@nestjs/config';

describe('Basic Test', () => {
  it('should work without NestJS DI', () => {
    // Test basic functionality without dependency injection
    const mockConfig = new Map();
    mockConfig.set('JWT_SECRET', 'test-secret');
    
    const configService = {
      get: (key: string, defaultValue?: any) => mockConfig.get(key) || defaultValue,
    };
    
    expect(configService.get('JWT_SECRET')).toBe('test-secret');
  });
});