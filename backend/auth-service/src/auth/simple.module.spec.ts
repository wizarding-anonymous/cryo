import { ConfigModule } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

describe('Simple Module Test', () => {
  it('should be defined', () => {
    expect(ConfigModule).toBeDefined();
  });

  it('should have forRoot method', () => {
    expect(typeof ConfigModule.forRoot).toBe('function');
  });

  it('should have test environment file', () => {
    const envTestPath = path.join(__dirname, '../../.env.test');
    expect(fs.existsSync(envTestPath)).toBe(true);
  });

  it('should contain JWT_SECRET in test env file', () => {
    const envTestPath = path.join(__dirname, '../../.env.test');
    const envContent = fs.readFileSync(envTestPath, 'utf8');
    expect(envContent).toContain('JWT_SECRET=test-jwt-secret-key-for-testing-only');
  });
});