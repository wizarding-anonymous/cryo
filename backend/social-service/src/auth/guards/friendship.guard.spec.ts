import { Test, TestingModule } from '@nestjs/testing';
import { FriendshipGuard } from './friendship.guard';
import { FriendsService } from '../../friends/friends.service';
import { ExecutionContext } from '@nestjs/common';
import { NotFriendsException } from '../../common/exceptions/not-friends.exception';

const mockFriendsService = {
  checkFriendship: jest.fn(),
};

describe('FriendshipGuard', () => {
  let guard: FriendshipGuard;
  let friendsService: FriendsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FriendshipGuard,
        {
          provide: FriendsService,
          useValue: mockFriendsService,
        },
      ],
    }).compile();

    guard = module.get<FriendshipGuard>(FriendshipGuard);
    friendsService = module.get<FriendsService>(FriendsService);
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (request: any) => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true if users are friends', async () => {
    const request = { user: { userId: 'user1' }, body: { toUserId: 'user2' } };
    const mockContext = createMockExecutionContext(request);
    mockFriendsService.checkFriendship.mockResolvedValue(true);

    const canActivate = await guard.canActivate(mockContext);
    expect(canActivate).toBe(true);
    expect(friendsService.checkFriendship).toHaveBeenCalledWith(
      'user1',
      'user2',
    );
  });

  it('should throw NotFriendsException if users are not friends', async () => {
    const request = { user: { userId: 'user1' }, body: { toUserId: 'user2' } };
    const mockContext = createMockExecutionContext(request);
    mockFriendsService.checkFriendship.mockResolvedValue(false);

    await expect(guard.canActivate(mockContext)).rejects.toThrow(
      NotFriendsException,
    );
  });

  it('should return true if no toUserId is provided in body', async () => {
    const request = { user: { userId: 'user1' }, body: {} };
    const mockContext = createMockExecutionContext(request);

    const canActivate = await guard.canActivate(mockContext);
    expect(canActivate).toBe(true);
    expect(friendsService.checkFriendship).not.toHaveBeenCalled();
  });

  it('should return false if user is not on the request', async () => {
    const request = { body: { toUserId: 'user2' } };
    const mockContext = createMockExecutionContext(request);

    const canActivate = await guard.canActivate(mockContext);
    expect(canActivate).toBe(false);
    expect(friendsService.checkFriendship).not.toHaveBeenCalled();
  });
});
