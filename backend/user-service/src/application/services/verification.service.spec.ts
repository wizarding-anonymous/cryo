import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VerificationService } from './verification.service';
import { EventPublisher } from '../events/event-publisher.service';
import { DeveloperProfile } from '../../domain/entities/developer-profile.entity';
import { PublisherProfile } from '../../domain/entities/publisher-profile.entity';
import { VerificationState } from './types/verification.types';

describe('VerificationService', () => {
  let service: VerificationService;
  let developerProfileRepository: Repository<DeveloperProfile>;
  let eventPublisher: EventPublisher;

  const mockDeveloperProfileRepository = {
    save: jest.fn(),
    findOneBy: jest.fn(),
  };
  const mockPublisherProfileRepository = {
    save: jest.fn(),
    findOneBy: jest.fn(),
  };
  const mockEventPublisher = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        {
          provide: getRepositoryToken(DeveloperProfile),
          useValue: mockDeveloperProfileRepository,
        },
        {
          provide: getRepositoryToken(PublisherProfile),
          useValue: mockPublisherProfileRepository,
        },
        {
          provide: EventPublisher,
          useValue: mockEventPublisher,
        },
      ],
    }).compile();

    service = module.get<VerificationService>(VerificationService);
    developerProfileRepository = module.get<Repository<DeveloperProfile>>(getRepositoryToken(DeveloperProfile));
    eventPublisher = module.get<EventPublisher>(EventPublisher);
  });

  it('should transition to APPROVED state with high confidence check', async () => {
    const userId = 'some-user-id';
    const mockProfile = { userId, verificationStatus: '' };
    mockDeveloperProfileRepository.findOneBy.mockResolvedValue(mockProfile);

    // Mock the smart check to return a high confidence result
    jest.spyOn(service as any, 'runAutomaticChecks').mockResolvedValue({
      isValid: true,
      confidence: 0.9,
      reason: 'Looks good',
    });

    const finalState = await service.submitForVerification(userId, [], 'developer');

    expect(finalState).toBe(VerificationState.APPROVED);
    expect(mockDeveloperProfileRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ verificationStatus: 'approved' }),
    );
    expect(mockEventPublisher.publish).toHaveBeenCalled();
  });
});
