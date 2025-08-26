import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BasicPublisherService } from './basic-publisher.service';
import { EventPublisher } from '../events/event-publisher.service';
import { PublisherProfile } from '../../domain/entities/publisher-profile.entity';
import { User } from '../../domain/entities/user.entity';
import { VerificationStatus } from '../events/types/verification-status.enum';
import { IPublisherVerification } from '../../domain/interfaces/publisher.interface';

describe('BasicPublisherService', () => {
  let service: BasicPublisherService;
  let publisherProfileRepository: Repository<PublisherProfile>;
  let eventPublisher: EventPublisher;

  const mockPublisherProfileRepository = {
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
        BasicPublisherService,
        {
          provide: getRepositoryToken(PublisherProfile),
          useValue: mockPublisherProfileRepository,
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

    service = module.get<BasicPublisherService>(BasicPublisherService);
    publisherProfileRepository = module.get<Repository<PublisherProfile>>(getRepositoryToken(PublisherProfile));
    eventPublisher = module.get<EventPublisher>(EventPublisher);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateVerificationStatus', () => {
    it('should update status within JSONB field and publish an event', async () => {
      const userId = 'some-user-id';
      const initialVerification: IPublisherVerification = {
        isVerified: false,
        status: VerificationStatus.Pending,
        verificationLevel: 'basic',
        verificationBadges: [],
      };
      const mockProfile = { userId, verification: initialVerification };

      mockPublisherProfileRepository.findOneBy.mockResolvedValue(mockProfile);
      mockPublisherProfileRepository.save.mockResolvedValue(mockProfile); // Mock the save return

      await service.updateVerificationStatus(userId, VerificationStatus.Approved);

      expect(mockPublisherProfileRepository.findOneBy).toHaveBeenCalledWith({ userId });

      const savedData = mockPublisherProfileRepository.save.mock.calls[0][0];
      expect(savedData.verification.status).toBe(VerificationStatus.Approved);
      expect(savedData.verification.isVerified).toBe(true);
      expect(savedData.verification.verifiedAt).toBeDefined();

      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'publisher.verification.changed',
        expect.any(Object),
        expect.any(Function),
      );
    });
  });
});
