import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HistoryService } from './history.service';
import { PurchaseHistory } from './entities/purchase-history.entity';
import { NotFoundException } from '@nestjs/common';
import { HistoryQueryDto } from './dto/request.dto';
import { AddGameToLibraryDto } from '../library/dto/request.dto';

describe('HistoryService', () => {
  let service: HistoryService;
  let repository: Repository<PurchaseHistory>;

  const mockHistoryRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoryService,
        {
          provide: getRepositoryToken(PurchaseHistory),
          useValue: mockHistoryRepository,
        },
      ],
    }).compile();

    service = module.get<HistoryService>(HistoryService);
    repository = module.get<Repository<PurchaseHistory>>(
      getRepositoryToken(PurchaseHistory),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPurchaseHistory', () => {
    it('should return a paginated list of purchase history', async () => {
      const mockHistory = [{ id: '1', userId: 'user1', gameId: 'game1' }];
      mockHistoryRepository.findAndCount.mockResolvedValue([mockHistory, 1]);

      const queryDto = new HistoryQueryDto();
      queryDto.page = 1;
      queryDto.limit = 10;

      const result = await service.getPurchaseHistory('user1', queryDto);

      expect(result.history).toEqual(mockHistory);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('getPurchaseDetails', () => {
    it('should return purchase details for a valid id', async () => {
      const mockPurchase = new PurchaseHistory();
      mockHistoryRepository.findOne.mockResolvedValue(mockPurchase);

      const result = await service.getPurchaseDetails('user1', 'purchase1');
      expect(result).toEqual(mockPurchase);
    });

    it('should throw NotFoundException for an invalid id', async () => {
      mockHistoryRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getPurchaseDetails('user1', 'invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPurchaseRecord', () => {
    it('should create a new purchase record', async () => {
      const dto: AddGameToLibraryDto = {
        userId: 'user1',
        gameId: 'game1',
        orderId: 'order1',
        purchaseId: 'purchase1',
        purchasePrice: 10.0,
        currency: 'USD',
        purchaseDate: new Date().toISOString(),
      };
      const newRecord = new PurchaseHistory();

      mockHistoryRepository.create.mockReturnValue(newRecord);
      mockHistoryRepository.save.mockResolvedValue(newRecord);

      const result = await service.createPurchaseRecord(dto);
      expect(result).toEqual(newRecord);
      expect(mockHistoryRepository.create).toHaveBeenCalledWith({
        id: dto.purchaseId,
        userId: dto.userId,
        gameId: dto.gameId,
        orderId: dto.orderId,
        amount: dto.purchasePrice,
        currency: dto.currency,
      });
      expect(mockHistoryRepository.save).toHaveBeenCalledWith(newRecord);
    });
  });
});
