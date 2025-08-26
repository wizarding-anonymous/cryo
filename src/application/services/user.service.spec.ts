import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from './user.service';
import { UserActivationService } from './user-activation.service';
import { IEmailService } from '../../domain/interfaces/email.interface';
import { User } from '../../domain/entities/user.entity';
import { ConflictException } from '@nestjs/common';

describe('UserService', () => {
  let service: UserService;
  let userRepository: Repository<User>;
  let activationService: UserActivationService;
  let emailService: IEmailService;

  const mockUserRepository = {
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockActivationService = {
    generateActivationToken: jest.fn(),
  };

  const mockEmailService = {
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
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
          provide: UserActivationService,
          useValue: mockActivationService,
        },
        {
          provide: IEmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    activationService = module.get<UserActivationService>(UserActivationService);
    emailService = module.get<IEmailService>(IEmailService);

    jest.clearAllMocks();
  });

  it('should create a user successfully', async () => {
    mockUserRepository.findOneBy.mockResolvedValue(null);
    mockUserRepository.create.mockReturnValue({ email: 'test@test.com' } as User);
    mockUserRepository.save.mockResolvedValue({ id: 'user-id', email: 'test@test.com' } as User);
    mockActivationService.generateActivationToken.mockResolvedValue('test-token');

    const dto = { email: 'test@test.com', username: 'testuser', password: 'Password123' };
    await service.createUser(dto);

    expect(mockUserRepository.findOneBy).toHaveBeenCalledTimes(2);
    expect(mockUserRepository.save).toHaveBeenCalled();
    expect(mockActivationService.generateActivationToken).toHaveBeenCalledWith('user-id');
    expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith('test@test.com', 'test-token');
  });

  it('should throw ConflictException if email exists', async () => {
    mockUserRepository.findOneBy.mockResolvedValue({ id: 'user-id' } as User);
    const dto = { email: 'test@test.com', username: 'testuser', password: 'Password123' };

    await expect(service.createUser(dto)).rejects.toThrow(ConflictException);
  });
});
