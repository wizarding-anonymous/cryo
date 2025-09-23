import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PurchaseHistoryRepository } from './purchase-history.repository';
import { PurchaseHistory } from '../entities/purchase-history.entity';
import { HistoryQueryDto, HistorySortBy } from '../dto/request.dto';

describe('PurchaseHistoryRepository', () => {
  let repository: PurchaseHistoryRepository;
  let typeormRepository: Repository<PurchaseHistory>;

  const mockTypeormRepository = {
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(),
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

  describe('findUserHistoryWithFilters', () => {
    it('applies status and date filters and sorting', async () => {
      const userId = 'user123';
      const queryDto = new HistoryQueryDto();
      queryDto.page = 2;
      queryDto.limit = 10;
      queryDto.sortBy = HistorySortBy.STATUS;
      queryDto.sortOrder = 'asc';

      const qb: Partial<SelectQueryBuilder<PurchaseHistory>> = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);

      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-12-31');

      const result = await repository.findUserHistoryWithFilters(
        userId,
        queryDto,
        { status: 'completed', dateFrom, dateTo, minAmount: 10, maxAmount: 100, gameId: 'g1', orderId: 'o1' },
      );

      expect(result).toEqual([[], 0]);
      expect(mockTypeormRepository.createQueryBuilder).toHaveBeenCalledWith('ph');
      expect(qb.where).toHaveBeenCalledWith('ph."userId" = :userId', { userId });
      expect(qb.andWhere).toHaveBeenCalledWith('ph."status" = :status', { status: 'completed' });
      expect(qb.andWhere).toHaveBeenCalledWith('ph."createdAt" >= :dateFrom', { dateFrom });
      expect(qb.andWhere).toHaveBeenCalledWith('ph."createdAt" <= :dateTo', { dateTo });
      expect(qb.andWhere).toHaveBeenCalledWith('ph."amount" >= :minAmount', { minAmount: 10 });
      expect(qb.andWhere).toHaveBeenCalledWith('ph."amount" <= :maxAmount', { maxAmount: 100 });
      expect(qb.andWhere).toHaveBeenCalledWith('ph."gameId" = :gameId', { gameId: 'g1' });
      expect(qb.andWhere).toHaveBeenCalledWith('ph."orderId" = :orderId', { orderId: 'o1' });
      expect(qb.orderBy).toHaveBeenCalledWith('ph."status"', 'ASC');
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(qb.getManyAndCount).toHaveBeenCalled();
    });
  });
});
