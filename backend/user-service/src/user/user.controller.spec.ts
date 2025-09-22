import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';

describe('UserController', () => {
  let controller: UserController;
  let userService: UserService;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedPassword',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserService = {
    findById: jest.fn(),
    updateProfile: jest.fn(),
    deleteUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const req = {
        user: { userId: mockUser.id, email: mockUser.email },
      } as any;

      mockUserService.findById.mockResolvedValue(mockUser);

      const result = await controller.getProfile(req);

      expect(userService.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockUser);
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const req = {
        user: { userId: mockUser.id, email: mockUser.email },
      } as any;
      const updateDto: UpdateProfileDto = { name: 'Updated Name' };
      const updatedUser = { ...mockUser, name: 'Updated Name' };

      mockUserService.updateProfile.mockResolvedValue(updatedUser);

      const result = await controller.updateProfile(req, updateDto);

      expect(userService.updateProfile).toHaveBeenCalledWith(
        mockUser.id,
        updateDto,
      );
      expect(result).toEqual(updatedUser);
    });
  });

  describe('deleteProfile', () => {
    it('should delete user profile', async () => {
      const req = {
        user: { userId: mockUser.id, email: mockUser.email },
      } as any;

      mockUserService.deleteUser.mockResolvedValue(undefined);

      await controller.deleteProfile(req);

      expect(userService.deleteUser).toHaveBeenCalledWith(mockUser.id);
    });
  });
});