import { AuthModule } from './auth.module';

describe('AuthModule', () => {
  it('should be defined', () => {
    expect(AuthModule).toBeDefined();
  });

  it('should have proper module metadata', () => {
    const moduleMetadata = Reflect.getMetadata('imports', AuthModule) || [];
    expect(moduleMetadata.length).toBeGreaterThan(0);
  });

  it('should export AuthService', () => {
    const exports = Reflect.getMetadata('exports', AuthModule) || [];
    const exportNames = exports.map(exp => exp.name || exp);
    expect(exportNames).toContain('AuthService');
  });
});