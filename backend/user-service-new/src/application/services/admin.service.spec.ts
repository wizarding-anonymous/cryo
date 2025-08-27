import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminService } from './admin.service';
import { User } from '../../domain/entities/user.entity';
import { EventPublisher } from '../events/event-publisher.service';

describe('AdminService', () => {
  let service: AdminService;
  let userRepository: Repository<User>;

  // Mock QueryBuilder
  const mockQueryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  const mockUserRepo = {
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
    findOneBy: jest.fn(),
    save: jest.fn(),
  };


  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: EventPublisher, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should build a search query correctly', async () => {
    mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
    const criteria = { email: 'test@', isBlocked: true, sortBy: 'username', sortOrder: 'ASC' as 'ASC' };

    await service.searchUsers(criteria);

    expect(mockUserRepo.createQueryBuilder).toHaveBeenCalledWith('user');
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('user.email ILIKE :email', { email: '%test@%' });
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('user.isBlocked = :isBlocked', { isBlocked: true });
    expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('user.username', 'ASC');
  });
});
