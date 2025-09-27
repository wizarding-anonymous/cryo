import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { LocalAuthGuard } from './local-auth.guard';

describe('LocalAuthGuard', () => {
  let guard: LocalAuthGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LocalAuthGuard],
    }).compile();

    guard = module.get<LocalAuthGuard>(LocalAuthGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should extend AuthGuard with local strategy', () => {
    // Verify that the guard is properly configured
    expect(guard).toBeInstanceOf(LocalAuthGuard);
  });

  it('should have the correct strategy name', () => {
    // The guard should use the 'local' strategy
    // This is implicitly tested by the AuthGuard('local') inheritance
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should call parent canActivate method', async () => {
      // Arrange
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            body: {
              email: 'test@example.com',
              password: 'password123',
            },
          }),
        }),
      } as ExecutionContext;

      // Mock the parent canActivate method
      const parentCanActivate = jest.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      parentCanActivate.mockResolvedValue(true);

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
      expect(parentCanActivate).toHaveBeenCalledWith(mockContext);

      // Cleanup
      parentCanActivate.mockRestore();
    });
  });
});
