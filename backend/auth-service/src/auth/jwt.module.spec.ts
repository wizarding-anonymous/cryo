import { JwtModule } from '@nestjs/jwt';

describe('JwtModule', () => {
  it('should be defined', () => {
    expect(JwtModule).toBeDefined();
  });

  it('should be a NestJS module', () => {
    expect(typeof JwtModule).toBe('function');
  });

  it('should have register method', () => {
    expect(typeof JwtModule.register).toBe('function');
  });

  it('should have registerAsync method', () => {
    expect(typeof JwtModule.registerAsync).toBe('function');
  });
});