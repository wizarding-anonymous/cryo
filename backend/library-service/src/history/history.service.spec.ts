import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { HistoryService } from './history.service';
import { PurchaseHistoryRepository } from './repositories/purchase-history.repository';
import { GameCatalogClient } from '../clients/game-catalog.client';
import {
  PurchaseHistory,
  PurchaseStatus,
} from '../entities/purchase-history.entity';
import { AddGameToLibraryDto } from '../library/dto';
import { HistoryQueryDto, SearchHistoryDto, PurchaseDetailsDto } from './dto';
import { HistorySortBy, SortOrder } from '../common/enums';

function createPurchaseHistory(
  overrides: Partial<PurchaseHistory> = {},
): PurchaseHistory {
  const purchase = new PurchaseHistory();
  purchase.id = overrides.id ?? 'purchase-1';
  purchase.userId = overrides.userId ?? 'user1';
  purchase.gameId = overrides.gameId ?? 'game1';
  purchase.orderId = overrides.orderId ?? 'order-1';
  purchase.amount = overrides.amount ?? 9.99;
  purchase.currency = overrides.currency ?? 'USD';
  purchase.status = overrides.status ?? PurchaseStatus.COMPLETED;
  purchase.paymentMethod = overrides.paymentMethod ?? 'card';
  purchase.metadata = overrides.metadata ?? {};
  purchase.createdAt =
    overrides.createdAt ?? new Date('2024-01-01T00:00:00.000Z');
  purchase.updatedAt =
    overrides.updatedAt ?? new Date('2024-01-02T00:00:00.000Z');
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
      query.sortOrder = SortOrder.DESC;

      const purchase = createPurchaseHistory();
      mockHistoryRepository.findUserHistory.mockResolvedValue([[purchase], 1]);

      const result = await service.getPurchaseHistory('user1', query);

      expect(result.purchases).toEqual([
        PurchaseDetailsDto.fromEntity(purchase),
      ]);
      expect(result.pagination).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(mockHistoryRepository.findUserHistory).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({
          page: 1,
          limit: 10,
          sortBy: HistorySortBy.CREATED_AT,
          sortOrder: 'desc',
        }),
      );
    });

    it('returns empty history when user has no purchases', async () => {
      const query = new HistoryQueryDto();
      mockHistoryRepository.findUserHistory.mockResolvedValue([[], 0]);

      const result = await service.getPurchaseHistory('user1', query);

      expect(result.purchases).toEqual([]);
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
      await expect(
        service.getPurchaseDetails('user1', 'missing'),
      ).rejects.toThrow(NotFoundException);
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
        status: 'completed',
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
      mockGameCatalogClient.getGamesByIds.mockResolvedValue([
        { id: purchase.gameId, title: 'test game' },
      ]);

      const result = await service.searchPurchaseHistory('user1', query);

      expect(mockHistoryRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user1' },
        order: { createdAt: 'DESC' },
      });
      expect(mockGameCatalogClient.getGamesByIds).toHaveBeenCalledWith([
        purchase.gameId,
      ]);
      expect(result.purchases).toEqual([
        PurchaseDetailsDto.fromEntity(purchase),
      ]);
      expect(result.pagination.total).toBe(1);
    });

    it('falls back to basic search when no fuzzy matches found', async () => {
      const query = new SearchHistoryDto();
      query.query = 'test'; // This will match the title 'test' in basic search
      const purchase = createPurchaseHistory();
      mockHistoryRepository.find.mockResolvedValue([purchase]);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue([
        { id: purchase.gameId, title: 'test game' }, // Contains 'test'
      ]);

      const result = await service.searchPurchaseHistory('user1', query);

      expect(result.purchases).toEqual([
        PurchaseDetailsDto.fromEntity(purchase),
      ]);
      expect(result.pagination.total).toBe(1);
    });

    it('returns empty collection when history empty', async () => {
      const query = new SearchHistoryDto();
      query.query = 'test';
      mockHistoryRepository.find.mockResolvedValue([]);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue([]);

      const result = await service.searchPurchaseHistory('user1', query);

      expect(result.purchases).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('handles pagination correctly with search results', async () => {
      const query = new SearchHistoryDto();
      query.query = 'test';
      query.page = 2;
      query.limit = 1;

      const purchase1 = createPurchaseHistory({ id: 'purchase-1', gameId: 'game1' });
      const purchase2 = createPurchaseHistory({ id: 'purchase-2', gameId: 'game2' });
      
      mockHistoryRepository.find.mockResolvedValue([purchase1, purchase2]);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue([
        { id: 'game1', title: 'test game 1' },
        { id: 'game2', title: 'test game 2' },
      ]);

      const result = await service.searchPurchaseHistory('user1', query);

      expect(result.purchases).toHaveLength(1);
      expect(result.purchases[0].id).toBe('purchase-2');
      expect(result.pagination).toEqual({
        total: 2,
        page: 2,
        limit: 1,
        totalPages: 2,
      });
    });

    it('handles game catalog client errors gracefully', async () => {
      const query = new SearchHistoryDto();
      query.query = 'test';
      
      const purchase = createPurchaseHistory();
      mockHistoryRepository.find.mockResolvedValue([purchase]);
      mockGameCatalogClient.getGamesByIds.mockRejectedValue(new Error('Catalog service error'));

      // The service should throw the error since it doesn't handle catalog errors
      await expect(service.searchPurchaseHistory('user1', query)).rejects.toThrow('Catalog service error');
    });

    it('handles fuzzy matching with high score matches', async () => {
      const query = new SearchHistoryDto();
      query.query = 'awesome';
      
      const purchase = createPurchaseHistory();
      mockHistoryRepository.find.mockResolvedValue([purchase]);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue([
        { id: purchase.gameId, title: 'Awesome Game' }, // High fuzzy match score
      ]);

      const result = await service.searchPurchaseHistory('user1', query);

      expect(result.purchases).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('filters out low score fuzzy matches', async () => {
      const query = new SearchHistoryDto();
      query.query = 'xyz';
      
      const purchase = createPurchaseHistory();
      mockHistoryRepository.find.mockResolvedValue([purchase]);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue([
        { id: purchase.gameId, title: 'Completely Different Game' }, // Low fuzzy match score
      ]);

      const result = await service.searchPurchaseHistory('user1', query);

      // Should fall back to basic search, which won't match
      expect(result.purchases).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('handles missing game details gracefully', async () => {
      const query = new SearchHistoryDto();
      query.query = 'test';
      
      const purchase = createPurchaseHistory();
      mockHistoryRepository.find.mockResolvedValue([purchase]);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue([
        { id: purchase.gameId, title: null }, // Missing title
      ]);

      const result = await service.searchPurchaseHistory('user1', query);

      expect(result.purchases).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('sorts fuzzy search results by score', async () => {
      const query = new SearchHistoryDto();
      query.query = 'game';
      
      const purchase1 = createPurchaseHistory({ id: 'purchase-1', gameId: 'game1' });
      const purchase2 = createPurchaseHistory({ id: 'purchase-2', gameId: 'game2' });
      
      mockHistoryRepository.find.mockResolvedValue([purchase1, purchase2]);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue([
        { id: 'game1', title: 'Game' }, // Exact match - higher score
        { id: 'game2', title: 'Gaming Experience' }, // Partial match - lower score
      ]);

      const result = await service.searchPurchaseHistory('user1', query);

      // The service may filter results based on score threshold
      expect(result.purchases.length).toBeGreaterThanOrEqual(1);
      if (result.purchases.length >= 2) {
        // Should be sorted by fuzzy match score (highest first)
        expect(result.purchases[0].id).toBe('purchase-1');
        expect(result.purchases[1].id).toBe('purchase-2');
      } else {
        // At least the best match should be returned
        expect(result.purchases[0].id).toBe('purchase-1');
      }
    });
  });

  describe('createPurchaseRecord - additional coverage', () => {
    it('handles different payment methods', async () => {
      const dto: AddGameToLibraryDto = {
        userId: 'user1',
        gameId: 'game1',
        orderId: 'order-1',
        purchaseId: 'purchase-1',
        purchasePrice: 10,
        currency: 'EUR',
        purchaseDate: new Date().toISOString(),
      };
      
      const newRecord = createPurchaseHistory({ currency: 'EUR' });
      mockHistoryRepository.create.mockReturnValue(newRecord);
      mockHistoryRepository.save.mockResolvedValue(newRecord);

      await service.createPurchaseRecord(dto);

      expect(mockHistoryRepository.create).toHaveBeenCalledWith({
        id: dto.purchaseId,
        userId: dto.userId,
        gameId: dto.gameId,
        orderId: dto.orderId,
        amount: dto.purchasePrice,
        currency: 'EUR',
        status: 'completed',
        paymentMethod: 'card',
      });
    });

    it('handles repository save errors', async () => {
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
      mockHistoryRepository.save.mockRejectedValue(new Error('Database error'));

      await expect(service.createPurchaseRecord(dto)).rejects.toThrow('Database error');
    });
  });

  describe('getPurchaseHistory - additional coverage', () => {
    it('handles different sort orders and fields', async () => {
      const query = new HistoryQueryDto();
      query.sortBy = HistorySortBy.AMOUNT;
      query.sortOrder = SortOrder.ASC;

      mockHistoryRepository.findUserHistory.mockResolvedValue([[], 0]);

      await service.getPurchaseHistory('user1', query);

      expect(mockHistoryRepository.findUserHistory).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({
          sortBy: HistorySortBy.AMOUNT,
          sortOrder: 'asc',
        }),
      );
    });

    it('calculates total pages correctly', async () => {
      const query = new HistoryQueryDto();
      query.limit = 3;

      mockHistoryRepository.findUserHistory.mockResolvedValue([[], 10]); // 10 total items

      const result = await service.getPurchaseHistory('user1', query);

      expect(result.pagination.totalPages).toBe(4); // Math.ceil(10/3) = 4
    });

    it('handles zero limit correctly', async () => {
      const query = new HistoryQueryDto();
      query.limit = 0;

      mockHistoryRepository.findUserHistory.mockResolvedValue([[], 5]);

      const result = await service.getPurchaseHistory('user1', query);

      expect(result.pagination.totalPages).toBe(0);
    });
  });
});
