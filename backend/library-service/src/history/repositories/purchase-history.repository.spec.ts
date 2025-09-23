import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseHistoryRepository } from './purchase-history.repository';
import { PurchaseHistory } from '../entities/purchase-history.entity';
import { HistoryQueryDto, HistorySortBy } from '../dto/request.dto';

describe('PurchaseHistoryRepository', () => {
  let repository: PurchaseHistoryRepository;
  let typeormRepository: Repository<PurchaseHistory>;

  const mockTypeormRepository = {
    findAndCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseHistoryRepository,
        {
          provide: getRepositoryToken(PurchaseHistory),
          useValue: mockTypeormRepository,
        },
      ],
    }).compile();

    repository = module.get<PurchaseHistoryRepository>(PurchaseHistoryRepository);
    typeormRepository = module.get<Repository<PurchaseHistory>>(getRepositoryToken(PurchaseHistory));
    jest.clearAllMocks();
  });

  describe('findUserHistory', () => {
    it('returns user purchase history with pagination', async () => {
      const userId = 'user123';
      const queryDto = new HistoryQueryDto();
      queryDto.page = 1;
      queryDto.limit = 20;
      queryDto.sortBy = HistorySortBy.CREATED_AT;
      queryDto.sortOrder = 'desc';

      const mockHistory = [new PurchaseHistory()];
      const mockCount = 1;

      mockTypeormRepository.findAndCount.mockResolvedValue([mockHistory, mockCount]);

      const result = await repository.findUserHistory(userId, queryDto);

      expect(result).toEqual([mockHistory, mockCount]);
      expect(typeormRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          order: { createdAt: 'DESC' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('translates ascending sort order correctly', async () => {
      const userId = 'user123';
      const queryDto = new HistoryQueryDto();
      queryDto.sortBy = HistorySortBy.AMOUNT;
      queryDto.sortOrder = 'asc';

      mockTypeormRepository.findAndCount.mockResolvedValue([[], 0]);

      await repository.findUserHistory(userId, queryDto);

      expect(typeormRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { amount: 'ASC' },
        }),
      );
    });
  });
});
