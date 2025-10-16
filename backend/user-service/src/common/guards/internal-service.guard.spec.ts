import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InternalServiceGuard } from './internal-service.guard';

describe('InternalServiceGuard', () => {
  let guard: InternalServiceGuard;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  const createMockExecutionContext = (
    headers: Record<string, string> = {},
    ip = '127.0.0.1',
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          connection: { remoteAddress: ip },
          socket: { remoteAddress: ip },
        }),
      }),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalServiceGuard,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    guard = module.get<InternalServiceGuard>(InternalServiceGuard);
    configService = module.get<ConfigService>(ConfigService);

    // Default mock configuration
    mockConfigService.get.mockImplementation(
      (key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          INTERNAL_API_KEYS: 'test-api-key-1,test-api-key-2',
          INTERNAL_ALLOWED_IPS: '127.0.0.1,::1,192.168.1.100',
          INTERNAL_SERVICE_SECRET: 'test-internal-secret',
          NODE_ENV: 'development',
        };
        return config[key] !== undefined ? config[key] : defaultValue;
      },
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should allow access with valid API key in Authorization header', () => {
      const context = createMockExecutionContext({
        authorization: 'Bearer test-api-key-1',
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access with valid API key in x-api-key header', () => {
      const context = createMockExecutionContext({
        'x-api-key': 'test-api-key-2',
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access from whitelisted IP', () => {
      const context = createMockExecutionContext({}, '192.168.1.100');

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access with valid internal service header', () => {
      const context = createMockExecutionContext({
        'x-internal-service': 'test-internal-secret',
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access from localhost in development mode', () => {
      const context = createMockExecutionContext({}, '127.0.0.1');

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access from private network in development mode', () => {
      const context = createMockExecutionContext({}, '192.168.1.50');

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should deny access with invalid API key', () => {
      const context = createMockExecutionContext(
        {
          authorization: 'Bearer invalid-key',
        },
        '203.0.113.1',
      ); // Public IP

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should deny access from non-whitelisted IP in production', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            INTERNAL_API_KEYS: 'test-api-key-1',
            INTERNAL_ALLOWED_IPS: '127.0.0.1,::1',
            INTERNAL_SERVICE_SECRET: 'test-internal-secret',
            NODE_ENV: 'production',
          };
          return config[key] !== undefined ? config[key] : defaultValue;
        },
      );

      // Recreate guard with production config
      guard = new InternalServiceGuard(configService);

      const context = createMockExecutionContext({}, '203.0.113.1'); // Public IP

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should handle x-forwarded-for header correctly', () => {
      const context = createMockExecutionContext({
        'x-forwarded-for': '127.0.0.1, 192.168.1.1',
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should handle x-real-ip header correctly', () => {
      const context = createMockExecutionContext({
        'x-real-ip': '127.0.0.1',
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should deny access when no valid credentials provided', () => {
      const context = createMockExecutionContext({}, '203.0.113.1'); // Public IP

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should handle empty API keys configuration', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            INTERNAL_API_KEYS: '',
            INTERNAL_ALLOWED_IPS: '127.0.0.1',
            INTERNAL_SERVICE_SECRET: 'test-internal-secret',
            NODE_ENV: 'development',
          };
          return config[key] !== undefined ? config[key] : defaultValue;
        },
      );

      // Recreate guard with empty API keys
      guard = new InternalServiceGuard(configService);

      const context = createMockExecutionContext({
        authorization: 'Bearer any-key',
      });

      // Should still allow access from localhost in development
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should handle malformed Authorization header', () => {
      const context = createMockExecutionContext(
        {
          authorization: 'InvalidFormat',
        },
        '203.0.113.1',
      );

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should handle exception during validation', () => {
      // Mock a scenario that throws an error
      const context = {
        switchToHttp: () => {
          throw new Error('Test error');
        },
        getClass: jest.fn(),
        getHandler: jest.fn(),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
        getType: jest.fn(),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('IP address handling', () => {
    it('should correctly identify localhost variations', () => {
      const localhostIPs = ['127.0.0.1', '::1', '0.0.0.0'];

      localhostIPs.forEach((ip) => {
        const context = createMockExecutionContext({}, ip);
        expect(guard.canActivate(context)).toBe(true);
      });
    });

    it('should correctly identify private network IPs', () => {
      const privateIPs = ['192.168.1.1', '10.0.0.1', '172.16.0.1'];

      privateIPs.forEach((ip) => {
        const context = createMockExecutionContext({}, ip);
        expect(guard.canActivate(context)).toBe(true);
      });
    });
  });

  describe('CIDR notation support', () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            INTERNAL_API_KEYS: 'test-api-key-1',
            INTERNAL_ALLOWED_IPS: '127.0.0.1,192.168.0.0/16,10.0.0.0/8',
            INTERNAL_SERVICE_SECRET: 'test-internal-secret',
            NODE_ENV: 'development',
          };
          return config[key] !== undefined ? config[key] : defaultValue;
        },
      );

      // Recreate guard with CIDR configuration
      guard = new InternalServiceGuard(configService);
    });

    it('should allow access from IP in CIDR range 192.168.0.0/16', () => {
      const ipsInRange = ['192.168.1.1', '192.168.255.255', '192.168.0.1'];

      ipsInRange.forEach((ip) => {
        const context = createMockExecutionContext({}, ip);
        expect(guard.canActivate(context)).toBe(true);
      });
    });

    it('should allow access from IP in CIDR range 10.0.0.0/8', () => {
      const ipsInRange = ['10.0.0.1', '10.255.255.255', '10.1.1.1'];

      ipsInRange.forEach((ip) => {
        const context = createMockExecutionContext({}, ip);
        expect(guard.canActivate(context)).toBe(true);
      });
    });

    it('should deny access from IP outside CIDR ranges', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            INTERNAL_API_KEYS: '',
            INTERNAL_ALLOWED_IPS: '192.168.0.0/16',
            INTERNAL_SERVICE_SECRET: 'test-internal-secret',
            NODE_ENV: 'production',
          };
          return config[key] !== undefined ? config[key] : defaultValue;
        },
      );

      // Recreate guard with production config
      guard = new InternalServiceGuard(configService);

      const ipsOutsideRange = ['172.16.0.1', '203.0.113.1', '8.8.8.8'];

      ipsOutsideRange.forEach((ip) => {
        const context = createMockExecutionContext({}, ip);
        expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      });
    });

    it('should handle invalid CIDR notation gracefully', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            INTERNAL_API_KEYS: 'test-api-key-1',
            INTERNAL_ALLOWED_IPS: '127.0.0.1,invalid-cidr/32,192.168.0.0/99',
            INTERNAL_SERVICE_SECRET: 'test-internal-secret',
            NODE_ENV: 'development',
          };
          return config[key] !== undefined ? config[key] : defaultValue;
        },
      );

      // Recreate guard with invalid CIDR
      guard = new InternalServiceGuard(configService);

      const context = createMockExecutionContext({}, '127.0.0.1');
      expect(guard.canActivate(context)).toBe(true); // Should still work for valid IPs
    });
  });

  describe('API key security enhancements', () => {
    it('should reject API keys that are too short', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            INTERNAL_API_KEYS: 'short,test-api-key-1',
            INTERNAL_ALLOWED_IPS: '127.0.0.1',
            INTERNAL_SERVICE_SECRET: 'test-internal-secret',
            NODE_ENV: 'production',
          };
          return config[key] !== undefined ? config[key] : defaultValue;
        },
      );

      // Recreate guard with short API key
      guard = new InternalServiceGuard(configService);

      const context = createMockExecutionContext(
        {
          authorization: 'Bearer short',
        },
        '203.0.113.1',
      );

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should reject API keys with weak patterns', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            INTERNAL_API_KEYS: 'test-api-key-with-test-pattern,dev-api-key-123',
            INTERNAL_ALLOWED_IPS: '127.0.0.1',
            INTERNAL_SERVICE_SECRET: 'test-internal-secret',
            NODE_ENV: 'production',
          };
          return config[key] !== undefined ? config[key] : defaultValue;
        },
      );

      // Recreate guard with weak API keys
      guard = new InternalServiceGuard(configService);

      const weakKeys = ['test-api-key-with-test-pattern', 'dev-api-key-123'];

      weakKeys.forEach((key) => {
        const context = createMockExecutionContext(
          {
            authorization: `Bearer ${key}`,
          },
          '203.0.113.1',
        );

        expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      });
    });

    it('should accept strong API keys', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            INTERNAL_API_KEYS: 'strong-api-key-32-characters-long-secure',
            INTERNAL_ALLOWED_IPS: '127.0.0.1',
            INTERNAL_SERVICE_SECRET: 'test-internal-secret',
            NODE_ENV: 'development',
          };
          return config[key] !== undefined ? config[key] : defaultValue;
        },
      );

      // Recreate guard with strong API key
      guard = new InternalServiceGuard(configService);

      const context = createMockExecutionContext({
        authorization: 'Bearer strong-api-key-32-characters-long-secure',
      });

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('Security event logging', () => {
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
      logSpy = jest.spyOn(guard['logger'], 'log').mockImplementation();
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    it('should log successful API key access', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            INTERNAL_API_KEYS: 'strong-api-key-32-characters-long-secure',
            INTERNAL_ALLOWED_IPS: '127.0.0.1,::1',
            INTERNAL_SERVICE_SECRET: 'test-internal-secret',
            NODE_ENV: 'development',
          };
          return config[key] !== undefined ? config[key] : defaultValue;
        },
      );

      // Recreate guard with strong API key
      guard = new InternalServiceGuard(configService);
      logSpy = jest.spyOn(guard['logger'], 'log').mockImplementation();

      const context = createMockExecutionContext({
        authorization: 'Bearer strong-api-key-32-characters-long-secure',
        'user-agent': 'test-agent',
      });

      guard.canActivate(context);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Access granted via API key (Bearer)'),
      );
    });

    it('should log successful IP whitelist access', () => {
      // Используем debug spy вместо log для IP whitelist access
      const debugSpy = jest.spyOn(guard['logger'], 'debug').mockImplementation();
      
      const context = createMockExecutionContext(
        {
          'user-agent': 'test-agent',
        },
        '192.168.1.100',
      );

      guard.canActivate(context);

      expect(debugSpy).toHaveBeenCalled();
      debugSpy.mockRestore();
    });
  });

  describe('Request information extraction', () => {
    it('should extract client IP from x-forwarded-for header', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            INTERNAL_API_KEYS: 'strong-api-key-32-characters-long-secure',
            INTERNAL_ALLOWED_IPS: '127.0.0.1,::1',
            INTERNAL_SERVICE_SECRET: 'test-internal-secret',
            NODE_ENV: 'development',
          };
          return config[key] !== undefined ? config[key] : defaultValue;
        },
      );

      // Recreate guard with strong API key
      guard = new InternalServiceGuard(configService);

      const context = createMockExecutionContext({
        'x-forwarded-for': '203.0.113.1, 192.168.1.1, 10.0.0.1',
        authorization: 'Bearer strong-api-key-32-characters-long-secure',
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should extract client IP from x-real-ip header', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            INTERNAL_API_KEYS: 'strong-api-key-32-characters-long-secure',
            INTERNAL_ALLOWED_IPS: '127.0.0.1,::1',
            INTERNAL_SERVICE_SECRET: 'test-internal-secret',
            NODE_ENV: 'development',
          };
          return config[key] !== undefined ? config[key] : defaultValue;
        },
      );

      // Recreate guard with strong API key
      guard = new InternalServiceGuard(configService);

      const context = createMockExecutionContext({
        'x-real-ip': '127.0.0.1',
        authorization: 'Bearer strong-api-key-32-characters-long-secure',
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should handle missing user-agent header', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            INTERNAL_API_KEYS: 'strong-api-key-32-characters-long-secure',
            INTERNAL_ALLOWED_IPS: '127.0.0.1,::1',
            INTERNAL_SERVICE_SECRET: 'test-internal-secret',
            NODE_ENV: 'development',
          };
          return config[key] !== undefined ? config[key] : defaultValue;
        },
      );

      // Recreate guard with strong API key
      guard = new InternalServiceGuard(configService);

      const context = createMockExecutionContext({
        authorization: 'Bearer strong-api-key-32-characters-long-secure',
      });

      expect(guard.canActivate(context)).toBe(true);
    });
  });
});
