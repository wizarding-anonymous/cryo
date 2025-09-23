import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleGuard, ROLES_KEY, USER_ROLES } from './role.guard';

describe('RoleGuard', () => {
  let guard: RoleGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RoleGuard>(RoleGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access if no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'user1',
            username: 'testuser',
            roles: ['user'],
          },
        }),
      }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access if empty roles array is required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'user1',
            username: 'testuser',
            roles: ['user'],
          },
        }),
      }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access if user has the required role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([USER_ROLES.ADMIN]);
    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'user1',
            username: 'testuser',
            roles: [USER_ROLES.ADMIN, USER_ROLES.USER],
          },
        }),
      }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access if user has any of the required roles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([USER_ROLES.ADMIN, USER_ROLES.MODERATOR]);
    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'user1',
            username: 'testuser',
            roles: [USER_ROLES.MODERATOR, USER_ROLES.USER],
          },
        }),
      }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access if user does not have the required role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([USER_ROLES.ADMIN]);
    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'user1',
            username: 'testuser',
            roles: [USER_ROLES.USER],
          },
        }),
      }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow(
      'Insufficient permissions. Required roles: admin',
    );
  });

  it('should deny access if user has no roles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([USER_ROLES.ADMIN]);
    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'user1',
            username: 'testuser',
          },
        }),
      }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('User roles not found');
  });

  it('should throw UnauthorizedException if no user is present', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([USER_ROLES.ADMIN]);
    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow('Authentication required');
  });

  it('should throw UnauthorizedException if user has no id', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([USER_ROLES.ADMIN]);
    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            username: 'testuser',
            roles: [USER_ROLES.USER],
          },
        }),
      }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow('Invalid user data');
  });

  it('should handle roles as non-array gracefully', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([USER_ROLES.ADMIN]);
    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'user1',
            username: 'testuser',
            roles: 'user', // Invalid: should be array
          },
        }),
      }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('User roles not found');
  });
});
