import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserActivationService } from './user-activation.service';
import { UserToken } from '../../domain/entities/user-token.entity';
import { User } from '../../domain/entities/user.entity';
import { BadRequestException } from '@nestjs/common';

describe('UserActivationService', () => {
  let service: UserActivationService;
  let tokenRepository: Repository<UserToken>;
  let userRepository: Repository<User>;

  const mockTokenRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockUserRepository = {
    save: jest.fn(),
    findOneBy: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserActivationService,
        {
          provide: getRepositoryToken(UserToken),
          useValue: mockTokenRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UserActivationService>(UserActivationService);
    tokenRepository = module.get<Repository<UserToken>>(getRepositoryToken(UserToken));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should generate and save an activation token', async () => {
    const userId = 'user-id';
    await service.generateActivationToken(userId);
    expect(mockTokenRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId, token: expect.any(String) })
    );
    expect(mockTokenRepository.save).toHaveBeenCalled();
  });

  it('should throw BadRequestException for an invalid token', async () => {
    mockTokenRepository.findOne.mockResolvedValue(null);
    await expect(service.activateUser('invalid-token')).rejects.toThrow(BadRequestException);
  });
});
