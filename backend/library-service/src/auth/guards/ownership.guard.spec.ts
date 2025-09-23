import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OwnershipGuard, SKIP_OWNERSHIP_KEY } from './ownership.guard';
import { LibraryService } from '../../library/library.service';

describe('OwnershipGuard', () => {
  let guard: OwnershipGuard;
  let libraryService: LibraryService;
  let reflector: Reflector;

  const mockLibraryService = {
    checkGameOwnership: jest.fn(),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnershipGuard,
        { provide: LibraryService, useValue: mockLibraryService },
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<OwnershipGuard>(OwnershipGuard);
    libraryService = module.get<LibraryService>(LibraryService);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should skip ownership check when decorator is present', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(true);

    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user1' },
          params: { gameId: 'game1' },
        }),
      }),
    } as ExecutionContext;

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      SKIP_OWNERSHIP_KEY,
      [context.getHandler(), context.getClass()],
    );
    expect(libraryService.checkGameOwnership).not.toHaveBeenCalled();
  });

  it('should allow access if user owns the game', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(false);
    mockLibraryService.checkGameOwnership.mockResolvedValue({ owns: true });

    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user1' },
          params: { gameId: 'game1' },
        }),
      }),
    } as ExecutionContext;

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(libraryService.checkGameOwnership).toHaveBeenCalledWith(
      'user1',
      'game1',
    );
  });

  it('should deny access if user does not own the game', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(false);
    mockLibraryService.checkGameOwnership.mockResolvedValue({ owns: false });

    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user1' },
          params: { gameId: 'game1' },
        }),
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'You do not own this game',
    );
  });

  it('should allow access if no gameId is present in params', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(false);

    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user1' },
          params: {},
        }),
      }),
    } as ExecutionContext;

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(libraryService.checkGameOwnership).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException if no user is present', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(false);

    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({
          params: { gameId: 'game1' },
        }),
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Authentication required',
    );
  });

  it('should throw UnauthorizedException if user has no id', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(false);

    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: {},
          params: { gameId: 'game1' },
        }),
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should handle service errors gracefully', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(false);
    mockLibraryService.checkGameOwnership.mockRejectedValue(
      new Error('Database error'),
    );

    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user1' },
          params: { gameId: 'game1' },
        }),
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Unable to verify game ownership',
    );
  });
});
