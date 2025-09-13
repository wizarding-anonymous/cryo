import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { OwnershipGuard } from './ownership.guard';
import { LibraryService } from '../../library/library.service';

describe('OwnershipGuard', () => {
  let guard: OwnershipGuard;
  let libraryService: LibraryService;

  const mockLibraryService = {
    checkGameOwnership: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnershipGuard,
        { provide: LibraryService, useValue: mockLibraryService },
      ],
    }).compile();

    guard = module.get<OwnershipGuard>(OwnershipGuard);
    libraryService = module.get<LibraryService>(LibraryService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access if user owns the game', async () => {
    mockLibraryService.checkGameOwnership.mockResolvedValue({ owns: true });
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user1' },
          params: { gameId: 'game1' },
        }),
      }),
    } as ExecutionContext;

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should deny access if user does not own the game', async () => {
    mockLibraryService.checkGameOwnership.mockResolvedValue({ owns: false });
    const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'user1' },
            params: { gameId: 'game1' },
          }),
        }),
      } as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow('User does not own this resource.');
  });

  it('should allow access if no gameId is present in params', async () => {
    const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'user1' },
            params: {},
          }),
        }),
      } as ExecutionContext;

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});
