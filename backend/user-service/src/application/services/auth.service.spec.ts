import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { User } from '../../domain/entities/user.entity';
import { SocialAccount } from '../../domain/entities/social-account.entity';
import { SessionService } from './session.service';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let socialAccountRepository: Repository<SocialAccount>;
  let sessionService: SessionService;

  const mockUserRepo = { findOneBy: jest.fn() };
  const mockSocialRepo = { findOne: jest.fn() };
  const mockSessionService = {
    createSession: jest.fn().mockResolvedValue({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(SocialAccount), useValue: mockSocialRepo },
        { provide: SessionService, useValue: mockSessionService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    socialAccountRepository = module.get<Repository<SocialAccount>>(getRepositoryToken(SocialAccount));
    sessionService = module.get<SessionService>(SessionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('login method should create session and return tokens', async () => {
    const user = { id: 'user-id', username: 'test' };
    const deviceInfo = {
      type: 'desktop' as const,
      os: 'Windows',
      browser: 'Chrome',
      browserVersion: '1.0',
      version: '1.0',
      userAgent: 'test-agent',
    };
    const ipAddress = '127.0.0.1';
    const userAgent = 'test-agent';

    const result = await service.login(user, deviceInfo, ipAddress, userAgent);

    expect(mockSessionService.createSession).toHaveBeenCalledWith(user.id, deviceInfo, ipAddress);
    expect(result).toEqual({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
    });
  });
});
