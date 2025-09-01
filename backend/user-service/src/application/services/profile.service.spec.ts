import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileService } from './profile.service';
import { User } from '../../domain/entities/user.entity';

describe('ProfileService', () => {
  let service: ProfileService;
  let userRepository: Repository<User>;

  const mockUserRepo = {
    update: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProfileService, { provide: getRepositoryToken(User), useValue: mockUserRepo }],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should update privacy settings by merging with existing settings', async () => {
    const userId = 'user-id';
    const existingSettings = { profileVisibility: 'public', showEmail: true };
    const newSettings = { showEmail: false, showRealName: true };

    mockUserRepo.findOne.mockResolvedValue({ privacySettings: existingSettings });

    await service.updatePrivacySettings(userId, newSettings);

    const expectedSettings = {
      profileVisibility: 'public',
      showEmail: false,
      showRealName: true,
    };

    expect(mockUserRepo.update).toHaveBeenCalledWith(userId, { privacySettings: expectedSettings });
  });
});
