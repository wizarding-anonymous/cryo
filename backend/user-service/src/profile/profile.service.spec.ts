import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { UserService } from '../user/user.service';
import { NotFoundException } from '@nestjs/common';

// Mock implementations for dependencies
const mockUserService = {
  findById: jest.fn(),
  delete: jest.fn(),
  updateProfile: jest.fn(),
};

describe('ProfileService', () => {
  let service: ProfileService;
  let userService: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    userService = module.get<UserService>(UserService);
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
      const updatedUser = {
        id: userId,
        name: 'Updated Name',
        email: 'test@example.com',
        password: 'hashed_password',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserService.updateProfile.mockResolvedValue(updatedUser);

      const result = await service.updateProfile(userId, updateDto);

      expect(mockUserService.updateProfile).toHaveBeenCalledWith(
        userId,
        updateDto,
      );
      expect(result).toEqual({
        id: userId,
        name: 'Updated Name',
        email: 'test@example.com',
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      });
      expect(result).not.toHaveProperty('password');
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
