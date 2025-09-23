import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InternalAuthGuard } from './internal-auth.guard';

describe('InternalAuthGuard', () => {
  let guard: InternalAuthGuard;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalAuthGuard,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    guard = module.get<InternalAuthGuard>(InternalAuthGuard);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access in test environment', () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    });

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access for user with internal-service role', () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'production';
      return undefined;
    });

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'service1',
            roles: ['internal-service'],
          },
        }),
      }),
    } as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access for user with admin role', () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'production';
      return undefined;
    });

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'admin1',
            roles: ['admin'],
          },
        }),
      }),
    } as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access with valid internal API key in x-internal-api-key header', () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'production';
      if (key === 'INTERNAL_API_KEY') return 'secret-key-123';
      return undefined;
    });

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            'x-internal-api-key': 'secret-key-123',
          },
        }),
      }),
    } as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access with valid internal API key in x-internal-key header', () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'production';
      if (key === 'INTERNAL_API_KEY') return 'secret-key-123';
      return undefined;
    });

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            'x-internal-key': 'secret-key-123',
          },
        }),
      }),
    } as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access with valid internal token in Authorization header', () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'production';
      if (key === 'INTERNAL_API_KEY') return 'secret-key-123';
      return undefined;
    });

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            authorization: 'Internal secret-key-123',
          },
        }),
      }),
    } as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access with valid Bearer token matching internal key', () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'production';
      if (key === 'INTERNAL_API_KEY') return 'secret-key-123';
      return undefined;
    });

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            authorization: 'Bearer secret-key-123',
          },
        }),
      }),
    } as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access with invalid internal API key', () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'production';
      if (key === 'INTERNAL_API_KEY') return 'secret-key-123';
      return undefined;
    });

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            'x-internal-api-key': 'wrong-key',
          },
          ip: '127.0.0.1',
        }),
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow(
      'This endpoint is for internal service communication only',
    );
  });

  it('should deny access for regular user without internal role', () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'production';
      return undefined;
    });

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'user1',
            roles: ['user'],
          },
          ip: '127.0.0.1',
        }),
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should deny access when no authentication method is provided', () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'production';
      return undefined;
    });

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
          ip: '127.0.0.1',
        }),
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should deny access when INTERNAL_API_KEY is not configured', () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'production';
      if (key === 'INTERNAL_API_KEY') return undefined;
      return undefined;
    });

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            'x-internal-api-key': 'some-key',
          },
          ip: '127.0.0.1',
        }),
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
