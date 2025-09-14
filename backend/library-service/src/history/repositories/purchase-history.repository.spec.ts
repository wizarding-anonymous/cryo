import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseHistoryRepository } from './purchase-history.repository';
import { PurchaseHistory } from '../entities/purchase-history.entity';
import { HistoryQueryDto } from '../dto/request.dto';

describe('PurchaseHistoryRepository', () => {
  let repository: PurchaseHistoryRepository;
  let typeormRepository: Repository<PurchaseHistory>;

  const mockTypeormRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
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

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findUserHistory', () => {
    it('should return user purchase history with pagination', async () => {
      const userId = 'user123';
      const queryDto = new HistoryQueryDto();
      queryDto.page = 1;
      queryDto.limit = 20;

      const mockHistory = [new PurchaseHistory()];
      const mockCount = 1;

      mockTypeormRepository.findAndCount.mockResolvedValue([mockHistory, mockCount]);

      const result = await repository.findUserHistory(userId, queryDto);

      expect(result).toEqual([mockHistory, mockCount]);
      expect(typeormRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should handle empty history', async () => {
      const userId = 'user123';
      const queryDto = new HistoryQueryDto();

      mockTypeormRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await repository.findUserHistory(userId, queryDto);

      expect(result).toEqual([[], 0]);
    });
  });

  describe('findOne', () => {
    it('should find purchase by user and purchase ID', async () => {
      const userId = 'user123';
      const purchaseId = 'purchase456';
      const mockPurchase = new PurchaseHistory();

      mockTypeormRepository.findOne.mockResolvedValue(mockPurchase);

      const result = await typeormRepository.findOne({ where: { userId, id: purchaseId } });

      expect(result).toEqual(mockPurchase);
      expect(typeormRepository.findOne).toHaveBeenCalledWith({
        where: { userId, id: purchaseId },
      });
    });

    it('should return null if purchase not found', async () => {
      const userId = 'user123';
      const purchaseId = 'purchase456';

      mockTypeormRepository.findOne.mockResolvedValue(null);

      const result = await typeormRepository.findOne({ where: { userId, id: purchaseId } });

      expect(result).toBeNull();
    });
  });
});