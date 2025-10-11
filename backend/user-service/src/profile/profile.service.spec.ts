import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { UserService } from '../user/user.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let mockUserService: Partial<UserService>;

  beforeEach(async () => {
    mockUserService = {
      findById: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
    };

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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should call userService.findById with correct userId', async () => {
      const userId = 'test-user-id';
      const expectedUser = { id: userId, name: 'Test User', email: 'test@example.com' };
      
      (mockUserService.findById as jest.Mock).mockResolvedValue(expectedUser);

      const result = await service.getProfile(userId);

      expect(mockUserService.findById).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedUser);
    });
  });

  describe('updateProfile', () => {
    it('should call userService.updateProfile with correct parameters', async () => {
      const userId = 'test-user-id';
      const updateData = { name: 'Updated Name' };
      const expectedUser = { id: userId, name: 'Updated Name', email: 'test@example.com' };
      
      (mockUserService.updateProfile as jest.Mock).mockResolvedValue(expectedUser);

      const result = await service.updateProfile(userId, updateData);

      expect(mockUserService.updateProfile).toHaveBeenCalledWith(userId, updateData);
      expect(result).toEqual(expectedUser);
    });
  });

  describe('deleteProfile', () => {
    it('should call userService.deleteUser with correct userId', async () => {
      const userId = 'test-user-id';
      
      (mockUserService.deleteUser as jest.Mock).mockResolvedValue(undefined);

      await service.deleteProfile(userId);

      expect(mockUserService.deleteUser).toHaveBeenCalledWith(userId);
    });
  });
});