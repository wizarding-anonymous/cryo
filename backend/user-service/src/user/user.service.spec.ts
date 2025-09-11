import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { SecurityClient } from '../integrations/security/security.client';
import { NotFoundException } from '@nestjs/common';

// Mock implementations for dependencies
const mockUserRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  delete: jest.fn(),
};

const mockSecurityClient = {
  logSecurityEvent: jest.fn(),
};

describe('UserService', () => {
  let service: UserService;
  let repository: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: SecurityClient,
          useValue: mockSecurityClient,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should hash the password and create a new user', async () => {
      const createUserDto = { name: 'Test', email: 'test@example.com', password: 'password' };
      const hashedPassword = 'hashed_password';
      const userEntity = { ...createUserDto, password: hashedPassword };
      const savedUser = { id: 'a-uuid', ...userEntity };

      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword as never);
      mockUserRepository.create.mockReturnValue(userEntity);
      mockUserRepository.save.mockResolvedValue(savedUser);

      const result = await service.create(createUserDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 10);
      expect(mockUserRepository.create).toHaveBeenCalledWith(expect.objectContaining({ password: hashedPassword }));
      expect(mockUserRepository.save).toHaveBeenCalledWith(userEntity);
      expect(mockSecurityClient.logSecurityEvent).toHaveBeenCalled();
      expect(result).toEqual(savedUser);
    });
  });

  describe('findByEmail', () => {
    it('should return a user if found', async () => {
      const email = 'test@example.com';
      const user = { id: 'a-uuid', email };
      mockUserRepository.findOne.mockResolvedValue(user);

      const result = await service.findByEmail(email);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email } });
      expect(result).toEqual(user);
    });

    it('should return null if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      const result = await service.findByEmail('notfound@example.com');
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a user successfully', async () => {
      const userId = 'a-uuid';
      mockUserRepository.delete.mockResolvedValue({ affected: 1 });

      await service.delete(userId);

      expect(mockUserRepository.delete).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundException if user to delete is not found', async () => {
      const userId = 'a-uuid';
      mockUserRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.delete(userId)).rejects.toThrow(NotFoundException);
    });
  });
});
