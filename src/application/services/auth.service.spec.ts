import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { User } from '../../domain/entities/user.entity';
import { SocialAccount } from '../../domain/entities/social-account.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let socialAccountRepository: Repository<SocialAccount>;
  let jwtService: JwtService;

  const mockUserRepo = { findOneBy: jest.fn() };
  const mockSocialRepo = { findOne: jest.fn() };
  const mockJwtService = { sign: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(SocialAccount), useValue: mockSocialRepo },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    socialAccountRepository = module.get<Repository<SocialAccount>>(getRepositoryToken(SocialAccount));
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('login method should sign a jwt', () => {
    const user = { id: 'user-id', username: 'test' };
    mockJwtService.sign.mockReturnValue('test-token');

    const result = service.login(user);

    expect(mockJwtService.sign).toHaveBeenCalledWith({ username: user.username, sub: user.id });
    expect(result).toEqual({ accessToken: 'test-token' });
  });
});
