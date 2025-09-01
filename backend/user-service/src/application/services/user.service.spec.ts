import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from './user.service';
import { UserTokenService } from './user-token.service';
import { EventPublisher } from '../events/event-publisher.service';
import { IEmailService } from '../../domain/interfaces/email.interface';
import { ISocialServiceIntegration } from '../../domain/interfaces/social-service.interface';
import { User } from '../../domain/entities/user.entity';
import { ConflictException } from '@nestjs/common';

describe('UserService', () => {
  let service: UserService;
  let userRepository: Repository<User>;
  let tokenService: UserTokenService;
  let emailService: IEmailService;
  let eventPublisher: EventPublisher;

  const mockUserRepository = {
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockTokenService = {
    generateToken: jest.fn(),
    validateToken: jest.fn(),
  };

  const mockEmailService = {
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  };

  const mockEventPublisher = {
    publish: jest.fn(),
  };

  const mockSocialService = {
    notifyUserRegistered: jest.fn(),
    notifyUserProfileUpdated: jest.fn(),
    checkHealth: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: IEmailService,
          useValue: mockEmailService,
        },
        {
          provide: UserTokenService,
          useValue: mockTokenService,
        },
        {
          provide: EventPublisher,
          useValue: mockEventPublisher,
        },
        {
          provide: ISocialServiceIntegration,
          useValue: mockSocialService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    tokenService = module.get<UserTokenService>(UserTokenService);
    emailService = module.get<IEmailService>(IEmailService);
    eventPublisher = module.get<EventPublisher>(EventPublisher);

    jest.clearAllMocks();
  });

  it('should create a user successfully', async () => {
    mockUserRepository.findOneBy.mockResolvedValue(null);
    mockUserRepository.create.mockReturnValue({ email: 'test@test.com' } as User);
    mockUserRepository.save.mockResolvedValue({
      id: 'user-id',
      email: 'test@test.com',
      username: 'testuser',
      createdAt: new Date(),
    } as User);
    mockTokenService.generateToken.mockResolvedValue('test-token');

    const dto = { email: 'test@test.com', username: 'testuser', password: 'Password123' };
    await service.createUser(dto);

    expect(mockUserRepository.findOneBy).toHaveBeenCalledTimes(2);
    expect(mockUserRepository.save).toHaveBeenCalled();
    expect(mockTokenService.generateToken).toHaveBeenCalledWith('user-id', 'activation');
    expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith('test@test.com', 'test-token');
    expect(mockSocialService.notifyUserRegistered).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id',
        email: 'test@test.com',
        username: 'testuser',
        source: 'direct',
      }),
    );
  });

  it('should throw ConflictException if email exists', async () => {
    mockUserRepository.findOneBy.mockResolvedValue({ id: 'user-id' } as User);
    const dto = { email: 'test@test.com', username: 'testuser', password: 'Password123' };

    await expect(service.createUser(dto)).rejects.toThrow(ConflictException);
  });
});
