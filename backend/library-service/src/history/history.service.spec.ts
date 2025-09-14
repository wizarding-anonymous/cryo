import { Test, TestingModule } from '@nestjs/testing';
import { HistoryService } from './history.service';
import { PurchaseHistoryRepository } from './repositories/purchase-history.repository';
import { GameCatalogClient } from '../clients/game-catalog.client';
import { PurchaseHistory } from './entities/purchase-history.entity';
import { NotFoundException } from '@nestjs/common';
import { AddGameToLibraryDto } from '../library/dto/request.dto';
import { HistoryQueryDto, SearchHistoryDto } from './dto/request.dto';

describe('HistoryService', () => {
  let service: HistoryService;
  let repository: PurchaseHistoryRepository;
  let gameCatalogClient: GameCatalogClient;

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
    repository = module.get<PurchaseHistoryRepository>(PurchaseHistoryRepository);
    gameCatalogClient = module.get<GameCatalogClient>(GameCatalogClient);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPurchaseHistory', () => {
    it('should return purchase history with pagination', async () => {
      const query = new HistoryQueryDto();
      const mockHistory = [new PurchaseHistory()];
      mockHistoryRepository.findUserHistory.mockResolvedValue([mockHistory, 1]);
      
      const result = await service.getPurchaseHistory('user1', query);
      
      expect(result.history).toEqual(mockHistory);
      expect(result.pagination.total).toBe(1);
      expect(mockHistoryRepository.findUserHistory).toHaveBeenCalledWith('user1', query);
    });

    it('should return empty history for user with no purchases', async () => {
      const query = new HistoryQueryDto();
      mockHistoryRepository.findUserHistory.mockResolvedValue([[], 0]);
      
      const result = await service.getPurchaseHistory('user1', query);
      
      expect(result.history).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('getPurchaseDetails', () => {
    it('should return purchase details', async () => {
      const purchase = new PurchaseHistory();
      mockHistoryRepository.findOne.mockResolvedValue(purchase);
      const result = await service.getPurchaseDetails('user1', 'purchase1');
      expect(result).toEqual(purchase);
    });

    it('should throw NotFoundException if purchase not found', async () => {
      mockHistoryRepository.findOne.mockResolvedValue(null);
      await expect(service.getPurchaseDetails('user1', 'purchase1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPurchaseRecord', () => {
    it('should create and save a purchase record', async () => {
      const dto: AddGameToLibraryDto = { userId: 'user1', gameId: 'game1', orderId: 'order1', purchaseId: 'purchase1', purchasePrice: 10.0, currency: 'USD', purchaseDate: new Date().toISOString() };
      const newRecord = new PurchaseHistory();
      mockHistoryRepository.create.mockReturnValue(newRecord);
      mockHistoryRepository.save.mockResolvedValue(newRecord);

      const result = await service.createPurchaseRecord(dto);
      expect(result).toEqual(newRecord);
      expect(mockHistoryRepository.create).toHaveBeenCalled();
      expect(mockHistoryRepository.save).toHaveBeenCalledWith(newRecord);
    });
  });

  describe('searchPurchaseHistory', () => {
    it('should return filtered history by game title', async () => {
      const query = new SearchHistoryDto();
      query.query = 'test';
      const historyItem = new PurchaseHistory();
      historyItem.gameId = 'game1';
      mockHistoryRepository.find.mockResolvedValue([historyItem]);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue([{ id: 'game1', title: 'test game' }]);

      const result = await service.searchPurchaseHistory('user1', query);

      expect(mockHistoryRepository.find).toHaveBeenCalledWith({ where: { userId: 'user1' }});
      expect(mockGameCatalogClient.getGamesByIds).toHaveBeenCalledWith(['game1']);
      expect(result.history.length).toBe(1);
    });

    it('should return empty results when no matches found', async () => {
      const query = new SearchHistoryDto();
      query.query = 'nonexistent';
      const historyItem = new PurchaseHistory();
      historyItem.gameId = 'game1';
      mockHistoryRepository.find.mockResolvedValue([historyItem]);
      mockGameCatalogClient.getGamesByIds.mockResolvedValue([{ id: 'game1', title: 'different game' }]);

      const result = await service.searchPurchaseHistory('user1', query);

      expect(result.history.length).toBe(0);
    });

    it('should handle empty purchase history', async () => {
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
