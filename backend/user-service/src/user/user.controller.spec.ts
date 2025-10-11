import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { NotFoundException } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';

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
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    updateLastLogin: jest.fn(),
    exists: jest.fn(),
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
      .overrideGuard(ThrottlerGuard)
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

  describe('createUser', () => {
    it('should create a new user', async () => {
      const createUserDto: CreateUserDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedPassword123',
      };

      mockUserService.create.mockResolvedValue(mockUser);

      const result = await controller.createUser(createUserDto);

      expect(userService.create).toHaveBeenCalledWith(createUserDto);
      expect(result).toEqual(mockUser);
    });
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      const email = 'test@example.com';
      mockUserService.findByEmail.mockResolvedValue(mockUser);

      const result = await controller.findByEmail(email);

      expect(userService.findByEmail).toHaveBeenCalledWith(email);
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      const email = 'notfound@example.com';
      mockUserService.findByEmail.mockResolvedValue(null);

      await expect(controller.findByEmail(email)).rejects.toThrow(NotFoundException);
      expect(userService.findByEmail).toHaveBeenCalledWith(email);
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const userId = mockUser.id;
      const params = { id: userId };
      mockUserService.findById.mockResolvedValue(mockUser);

      const result = await controller.findById(params);

      expect(userService.findById).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      const userId = 'nonexistent-id';
      const params = { id: userId };
      mockUserService.findById.mockResolvedValue(null);

      await expect(controller.findById(params)).rejects.toThrow(NotFoundException);
      expect(userService.findById).toHaveBeenCalledWith(userId);
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      const userId = mockUser.id;
      const params = { id: userId };
      mockUserService.updateLastLogin.mockResolvedValue(undefined);

      const result = await controller.updateLastLogin(params);

      expect(userService.updateLastLogin).toHaveBeenCalledWith(userId);
      expect(result).toEqual({ message: 'Last login updated successfully' });
    });
  });

  describe('checkUserExists', () => {
    it('should check if user exists', async () => {
      const userId = mockUser.id;
      const params = { id: userId };
      mockUserService.exists.mockResolvedValue(true);

      const result = await controller.checkUserExists(params);

      expect(userService.exists).toHaveBeenCalledWith(userId);
      expect(result).toEqual({ exists: true });
    });
  });
});
