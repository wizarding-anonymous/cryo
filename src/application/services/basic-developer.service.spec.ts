import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BasicDeveloperService } from './basic-developer.service';
import { EventPublisher } from '../events/event-publisher.service';
import { DeveloperProfile } from '../../domain/entities/developer-profile.entity';
import { User } from '../../domain/entities/user.entity';
import { VerificationStatus } from '../events/types/verification-status.enum';

describe('BasicDeveloperService', () => {
  let service: BasicDeveloperService;
  let developerProfileRepository: Repository<DeveloperProfile>;
  let userRepository: Repository<User>;
  let eventPublisher: EventPublisher;

  const mockDeveloperProfileRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOneBy: jest.fn(),
  };

  const mockUserRepository = {
    findOneBy: jest.fn(),
  };

  const mockEventPublisher = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BasicDeveloperService,
        {
          provide: getRepositoryToken(DeveloperProfile),
          useValue: mockDeveloperProfileRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: EventPublisher,
          useValue: mockEventPublisher,
        },
      ],
    }).compile();

    service = module.get<BasicDeveloperService>(BasicDeveloperService);
    developerProfileRepository = module.get<Repository<DeveloperProfile>>(getRepositoryToken(DeveloperProfile));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    eventPublisher = module.get<EventPublisher>(EventPublisher);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateVerificationStatus', () => {
    it('should update status and publish an event', async () => {
      const userId = 'some-user-id';
      const mockProfile = { userId, verificationStatus: VerificationStatus.Pending, isVerified: false };
      mockDeveloperProfileRepository.findOneBy.mockResolvedValue(mockProfile);
      mockDeveloperProfileRepository.save.mockResolvedValue({ ...mockProfile, verificationStatus: VerificationStatus.Approved, isVerified: true });

      await service.updateVerificationStatus(userId, VerificationStatus.Approved);

      expect(mockDeveloperProfileRepository.findOneBy).toHaveBeenCalledWith({ userId });
      expect(mockDeveloperProfileRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          verificationStatus: VerificationStatus.Approved,
          isVerified: true,
        }),
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'developer.verification.changed',
        expect.any(Object), // In a real test, we'd check the event payload more closely
        expect.any(Function),
      );
    });
  });
});
