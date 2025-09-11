import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileService } from './profile.service';
import { UserService } from '../user/user.service';
import { User } from '../user/entities/user.entity';
import { NotFoundException } from '@nestjs/common';

// Mock implementations for dependencies
const mockUserRepository = {
  preload: jest.fn(),
  save: jest.fn(),
};

const mockUserService = {
  findById: jest.fn(),
  delete: jest.fn(),
};

describe('ProfileService', () => {
  let service: ProfileService;
  let userService: UserService;
  let repository: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    userService = module.get<UserService>(UserService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return a user profile without the password', async () => {
      const userId = 'a-uuid';
      const user = {
        id: userId,
        name: 'Test',
        email: 'test@example.com',
        password: 'hashed_password',
      };
      mockUserService.findById.mockResolvedValue(user);

      const result = await service.getProfile(userId);

      expect(mockUserService.findById).toHaveBeenCalledWith(userId);
      expect(result).toEqual({
        id: userId,
        name: 'Test',
        email: 'test@example.com',
      });
      expect(result).not.toHaveProperty('password');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserService.findById.mockResolvedValue(null);
      await expect(service.getProfile('a-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('should update and return the user profile', async () => {
      const userId = 'a-uuid';
      const updateDto = { name: 'Updated Name' };
      const userToUpdate = { id: userId, name: 'Old Name' };
      const updatedUser = { id: userId, ...updateDto };

      mockUserRepository.preload.mockResolvedValue(userToUpdate);
      mockUserRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateProfile(userId, updateDto);

      expect(mockUserRepository.preload).toHaveBeenCalledWith({
        id: userId,
        ...updateDto,
      });
      expect(mockUserRepository.save).toHaveBeenCalledWith(userToUpdate);
      expect(result).not.toHaveProperty('password');
    });

    it('should throw NotFoundException if user to update is not found', async () => {
      mockUserRepository.preload.mockResolvedValue(null);
      await expect(service.updateProfile('a-uuid', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteProfile', () => {
    it('should call userService.delete with the correct id', async () => {
      const userId = 'a-uuid';
      mockUserService.delete.mockResolvedValue(undefined); // It returns Promise<void>

      await service.deleteProfile(userId);

      expect(mockUserService.delete).toHaveBeenCalledWith(userId);
    });
  });
});
