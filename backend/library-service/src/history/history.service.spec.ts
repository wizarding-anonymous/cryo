import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { HistoryService } from './history.service';
import { PurchaseHistoryRepository } from './repositories/purchase-history.repository';
import { GameCatalogClient } from '../clients/game-catalog.client';
import { PurchaseHistory, PurchaseStatus } from './entities/purchase-history.entity';
import { AddGameToLibraryDto } from '../library/dto/request.dto';
import { HistoryQueryDto, SearchHistoryDto, HistorySortBy } from './dto/request.dto';
import { PurchaseDetailsDto } from './dto/response.dto';

function createPurchaseHistory(overrides: Partial<PurchaseHistory> = {}): PurchaseHistory {
  const purchase = new PurchaseHistory();
  purchase.id = overrides.id ?? 'purchase-1';
  purchase.userId = overrides.userId ?? 'user1';
  purchase.gameId = overrides.gameId ?? 'game1';
  purchase.orderId = overrides.orderId ?? 'order-1';
  purchase.amount = overrides.amount ?? 9.99;
  purchase.currency = overrides.currency ?? 'USD';
  purchase.status = overrides.status ?? PurchaseStatus.COMPLETED;
  purchase.paymentMethod = overrides.paymentMethod ?? 'card';
  purchase.metadata = overrides.metadata ?? null;
  purchase.createdAt = overrides.createdAt ?? new Date('2024-01-01T00:00:00.000Z');
  purchase.updatedAt = overrides.updatedAt ?? new Date('2024-01-02T00:00:00.000Z');
  return purchase;
}

describe('HistoryService', () => {
  let service: HistoryService;

  const mockHistoryRepository = {
    findUserHistory: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockGameCatalogClient = {
    getGamesByIds: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoryService,
        { provide: PurchaseHistoryRepository, useValue: mockHistoryRepository },
        { provide: GameCatalogClient, useValue: mockGameCatalogClient },
      ],
    }).compile();

    service = module.get<HistoryService>(HistoryService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPurchaseHistory', () => {
    it('returns purchase history with pagination', async () => {
      const query = new HistoryQueryDto();
      query.page = 1;
      query.limit = 10;
      query.sortBy = HistorySortBy.CREATED_AT;
      query.sortOrder = 'desc';

      const purchase = createPurchaseHistory();
      mockHistoryRepository.findUserHistory.mockResolvedValue([[purchase], 1]);

      const result = await service.getPurchaseHistory('user1', query);

      expect(result.history).toEqual([PurchaseDetailsDto.fromEntity(purchase)]);
      expect(result.pagination).toEqual({ total: 1, page: 1, limit: 10, totalPages: 1 });
      expect(mockHistoryRepository.findUserHistory).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({ page: 1, limit: 10, sortBy: HistorySortBy.CREATED_AT, sortOrder: 'desc' }),
      );
    });

    it('returns empty history when user has no purchases', async () => {
      const query = new HistoryQueryDto();
      mockHistoryRepository.findUserHistory.mockResolvedValue([[], 0]);

      const result = await service.getPurchaseHistory('user1', query);

      expect(result.history).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('getPurchaseDetails', () => {
    it('returns purchase details when found', async () => {
      const purchase = createPurchaseHistory();
      mockHistoryRepository.findOne.mockResolvedValue(purchase);

      const result = await service.getPurchaseDetails('user1', purchase.id);
      expect(result).toEqual(purchase);
    });

    it('throws NotFoundException when purchase not found', async () => {
      mockHistoryRepository.findOne.mockResolvedValue(null);
      await expect(service.getPurchaseDetails('user1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPurchaseRecord', () => {
    it('creates and saves a purchase record', async () => {
      const dto: AddGameToLibraryDto = {
        userId: 'user1',
        gameId: 'game1',
        orderId: 'order-1',
        purchaseId: 'purchase-1',
        purchasePrice: 10,
        currency: 'USD',
        purchaseDate: new Date().toISOString(),
      };
      const newRecord = createPurchaseHistory();
      mockHistoryRepository.create.mockReturnValue(newRecord);
      mockHistoryRepository.save.mockResolvedValue(newRecord);

      const result = await service.createPurchaseRecord(dto);

      expect(result).toBe(newRecord);
      expect(mockHistoryRepository.create).toHaveBeenCalledWith({
        id: dto.purchaseId,
        userId: dto.userId,
        gameId: dto.gameId,
        orderId: dto.orderId,
        amount: dto.purchasePrice,
        currency: dto.currency,
        paymentMethod: 'card',
      });
      expect(mockHistoryRepository.save).toHaveBeenCalledWith(newRecord);
    });
  });

  describe('searchPurchaseHistory', () => {
    it('filters history by game title', async () => {
      const query = new SearchHistoryDto();
      query.query = 'test';
      query.page = 1;
      query.limit = 10;

      const purchase = createPurchaseHistory();
      mockHistoryRepository.find.mockResolvedValue([purchase]);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue([{ id: purchase.gameId, title: 'test game' }]);

      const result = await service.searchPurchaseHistory('user1', query);

      expect(mockHistoryRepository.find).toHaveBeenCalledWith({ where: { userId: 'user1' } });
      expect(mockGameCatalogClient.getGamesByIds).toHaveBeenCalledWith([purchase.gameId]);
      expect(result.history).toEqual([PurchaseDetailsDto.fromEntity(purchase)]);
      expect(result.pagination.total).toBe(1);
    });

    it('falls back to full history when no matches found', async () => {
      const query = new SearchHistoryDto();
      query.query = 'other';
      const purchase = createPurchaseHistory();
      mockHistoryRepository.find.mockResolvedValue([purchase]);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue([{ id: purchase.gameId, title: 'unrelated' }]);

      const result = await service.searchPurchaseHistory('user1', query);

      expect(result.history).toEqual([PurchaseDetailsDto.fromEntity(purchase)]);
      expect(result.pagination.total).toBe(1);
    });

    it('returns empty collection when history empty', async () => {
      const query = new SearchHistoryDto();
      query.query = 'test';
      mockHistoryRepository.find.mockResolvedValue([]);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue([]);

      const result = await service.searchPurchaseHistory('user1', query);

      expect(result.history).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });
});
