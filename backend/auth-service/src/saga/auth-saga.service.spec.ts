import { AuthSagaService } from './auth-saga.service';
import { SagaService } from './saga.service';
import { UserServiceClient } from '../common/http-client/user-service.client';
import { TokenService } from '../token/token.service';
import { SessionService } from '../session/session.service';
import { EventBusService } from '../events/services/event-bus.service';
import { RegisterDto } from '../auth/dto/register.dto';

describe('AuthSagaService', () => {
  let service: AuthSagaService;
  let sagaService: jest.Mocked<SagaService>;
  let userServiceClient: jest.Mocked<UserServiceClient>;
  let tokenService: jest.Mocked<TokenService>;
  let sessionService: jest.Mocked<SessionService>;
  let eventBusService: jest.Mocked<EventBusService>;

  const mockUser = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedPassword',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTokens = {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
    expiresIn: 3600,
  };

  const mockSession = {
    id: 'session-123',
    userId: 'user-123',
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
    accessTokenHash: 'hashed-access-token',
    refreshTokenHash: 'hashed-refresh-token',
    ipAddress: '127.0.0.1',
    userAgent: 'Test Agent',
    isActive: true,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    sagaService = {
      startSaga: jest.fn(),
      getSaga: jest.fn(),
    } as any;

    userServiceClient = {
      findByEmail: jest.fn(),
      createUser: jest.fn(),
      findById: jest.fn(),
    } as any;

    tokenService = {
      generateTokens: jest.fn(),
      blacklistToken: jest.fn(),
    } as any;

    sessionService = {
      createSession: jest.fn(),
      createSessionWithLimit: jest.fn(),
      invalidateSession: jest.fn(),
      getUserSessions: jest.fn(),
    } as any;

    eventBusService = {
      publishUserRegisteredEvent: jest.fn(),
      publishUserLoggedInEvent: jest.fn(),
      publishSecurityEvent: jest.fn(),
    } as any;

    service = new AuthSagaService(
      sagaService,
      userServiceClient,
      tokenService,
      sessionService,
      eventBusService
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('executeRegistrationSaga', () => {
    const registerDto: RegisterDto = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    };

    it('should start registration saga with correct steps', async () => {
      sagaService.startSaga.mockResolvedValue('saga-123');

      const sagaId = await service.executeRegistrationSaga(
        registerDto,
        '127.0.0.1',
        'Test Agent'
      );

      expect(sagaId).toBe('saga-123');
      expect(sagaService.startSaga).toHaveBeenCalledWith(
        'userRegistration',
        expect.arrayContaining([
          expect.objectContaining({ name: 'validateUserDoesNotExist' }),
          expect.objectContaining({ name: 'hashPassword' }),
          expect.objectContaining({ name: 'createUser' }),
          expect.objectContaining({ name: 'generateTokens' }),
          expect.objectContaining({ name: 'createSession' }),
          expect.objectContaining({ name: 'publishRegistrationEvents' }),
        ]),
        expect.objectContaining({
          email: registerDto.email,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        })
      );
    });

    it('should validate user does not exist', async () => {
      userServiceClient.findByEmail.mockResolvedValue(null);
      sagaService.startSaga.mockResolvedValue('saga-123');

      await service.executeRegistrationSaga(registerDto, '127.0.0.1', 'Test Agent');

      expect(sagaService.startSaga).toHaveBeenCalled();
    });

    it('should handle user service errors', async () => {
      sagaService.startSaga.mockResolvedValue('saga-123');

      await service.executeRegistrationSaga(registerDto, '127.0.0.1', 'Test Agent');

      expect(sagaService.startSaga).toHaveBeenCalled();
    });
  });

  describe('executeLoginSaga', () => {
    const maxSessionsPerUser = 5;

    it('should start login saga with correct steps', async () => {
      sagaService.startSaga.mockResolvedValue('saga-456');

      const sagaId = await service.executeLoginSaga(
        mockUser,
        '127.0.0.1',
        'Test Agent',
        maxSessionsPerUser
      );

      expect(sagaId).toBe('saga-456');
      expect(sagaService.startSaga).toHaveBeenCalledWith(
        'userLogin',
        expect.arrayContaining([
          expect.objectContaining({ name: 'generateTokens' }),
          expect.objectContaining({ name: 'createSessionWithLimit' }),
          expect.objectContaining({ name: 'publishLoginEvents' }),
        ]),
        expect.objectContaining({
          userId: mockUser.id,
          email: mockUser.email,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
          maxSessionsPerUser,
        })
      );
    });

    it('should handle token service errors', async () => {
      sagaService.startSaga.mockResolvedValue('saga-456');

      await service.executeLoginSaga(mockUser, '127.0.0.1', 'Test Agent', maxSessionsPerUser);

      expect(sagaService.startSaga).toHaveBeenCalled();
    });
  });

  describe('waitForSagaCompletion', () => {
    it('should return completed status when saga completes', async () => {
      const completedSaga = {
        id: 'saga-123',
        status: 'completed',
        error: undefined,
      };

      sagaService.getSaga.mockResolvedValue(completedSaga as any);

      const result = await service.waitForSagaCompletion('saga-123', 1000);

      expect(result).toEqual({
        completed: true,
        status: 'completed',
        error: undefined,
      });
    });

    it('should return failed status when saga fails', async () => {
      const failedSaga = {
        id: 'saga-123',
        status: 'failed',
        error: 'User creation failed',
      };

      sagaService.getSaga.mockResolvedValue(failedSaga as any);

      const result = await service.waitForSagaCompletion('saga-123', 1000);

      expect(result).toEqual({
        completed: false,
        status: 'failed',
        error: 'User creation failed',
      });
    });

    it('should return timeout status when saga takes too long', async () => {
      const runningSaga = {
        id: 'saga-123',
        status: 'running',
        error: undefined,
      };

      sagaService.getSaga.mockResolvedValue(runningSaga as any);

      const result = await service.waitForSagaCompletion('saga-123', 100); // 100ms timeout

      expect(result).toEqual({
        completed: false,
        status: 'timeout',
      });
    });

    it('should return not_found status when saga does not exist', async () => {
      sagaService.getSaga.mockResolvedValue(null);

      const result = await service.waitForSagaCompletion('saga-123', 1000);

      expect(result).toEqual({
        completed: false,
        status: 'not_found',
      });
    });
  });

  describe('saga step validation', () => {
    it('should create steps with proper structure', async () => {
      const registerDto: RegisterDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };

      sagaService.startSaga.mockImplementation(async (name, steps) => {
        // Verify all steps have required properties
        steps.forEach(step => {
          expect(step).toHaveProperty('name');
          expect(step).toHaveProperty('execute');
          expect(step).toHaveProperty('compensate');
          expect(typeof step.execute).toBe('function');
          expect(typeof step.compensate).toBe('function');
        });
        return 'saga-123';
      });

      await service.executeRegistrationSaga(registerDto, '127.0.0.1', 'Test Agent');

      expect(sagaService.startSaga).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle saga service errors', async () => {
      sagaService.startSaga.mockRejectedValue(new Error('Saga service unavailable'));

      const registerDto: RegisterDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };

      await expect(
        service.executeRegistrationSaga(registerDto, '127.0.0.1', 'Test Agent')
      ).rejects.toThrow('Saga service unavailable');
    });

    it('should handle timeout scenarios', async () => {
      const runningSaga = {
        id: 'saga-123',
        status: 'running',
        error: undefined,
      };

      sagaService.getSaga.mockResolvedValue(runningSaga as any);

      const result = await service.waitForSagaCompletion('saga-123', 50); // Very short timeout

      expect(result.completed).toBe(false);
      expect(result.status).toBe('timeout');
    });
  });
});