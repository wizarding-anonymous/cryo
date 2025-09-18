import { Test, TestingModule } from '@nestjs/testing';
import { StatusController } from './status.controller';
import { StatusService } from './status.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const mockStatusService = {
  setOnlineStatus: jest.fn(),
  setOfflineStatus: jest.fn(),
  getFriendsStatus: jest.fn(),
};

describe('StatusController', () => {
  let controller: StatusController;
  let service: StatusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatusController],
      providers: [
        {
          provide: StatusService,
          useValue: mockStatusService,
        },
      ],
    })
    .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
    .compile();

    controller = module.get<StatusController>(StatusController);
    service = module.get<StatusService>(StatusService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  const mockAuthRequest = { user: { userId: 'user1' } } as any;

  describe('setOnlineStatus', () => {
    it('should call service with correct params', async () => {
      const dto = { currentGame: 'Game1' };
      await controller.setOnlineStatus(mockAuthRequest, dto);
      expect(service.setOnlineStatus).toHaveBeenCalledWith('user1', dto.currentGame);
    });
  });

  describe('setOfflineStatus', () => {
    it('should call service with correct params', async () => {
      await controller.setOfflineStatus(mockAuthRequest);
      expect(service.setOfflineStatus).toHaveBeenCalledWith('user1');
    });
  });

  describe('getFriendsStatus', () => {
    it('should call service with correct params', async () => {
      await controller.getFriendsStatus(mockAuthRequest);
      expect(service.getFriendsStatus).toHaveBeenCalledWith('user1');
    });
  });
});
