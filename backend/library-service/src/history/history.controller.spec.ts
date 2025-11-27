import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';
import { HistoryController } from './history.controller';
import { HistoryService } from './history.service';
import { HistoryQueryDto, SearchHistoryDto, HistoryResponseDto } from './dto';
import { PurchaseHistory } from '../entities/purchase-history.entity';
import { AddGameToLibraryDto } from '../library/dto';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // TODO: Replace with new auth guards
// import { InternalAuthGuard } from '../auth/guards/internal-auth.guard'; // TODO: Replace with new auth guards
import { CacheInterceptor } from '../common/interceptors/cache.interceptor';

describe('HistoryController', () => {
  let controller: HistoryController;
  let historyService: HistoryService;

  const mockHistoryService = {
    getPurchaseHistory: jest.fn(),
    getPurchaseDetails: jest.fn(),
    searchPurchaseHistory: jest.fn(),
    createPurchaseRecord: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HistoryController],
      providers: [
        { provide: HistoryService, useValue: mockHistoryService },
        { provide: ConfigService, useValue: mockConfigService },
        // { provide: JwtAuthGuard, useValue: { canActivate: () => true } }, // TODO: Replace with new auth guards
        // { provide: InternalAuthGuard, useValue: { canActivate: () => true } }, // TODO: Replace with new auth guards
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        CacheInterceptor,
        Reflector,
      ],
    }).compile();

    controller = module.get<HistoryController>(HistoryController);
    historyService = module.get<HistoryService>(HistoryService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPurchaseHistory', () => {
    it('should return purchase history', async () => {
      const mockRequest = { user: { id: 'user123' } };
      const queryDto = new HistoryQueryDto();
      const mockResponse: HistoryResponseDto = {
        purchases: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };

      mockHistoryService.getPurchaseHistory.mockResolvedValue(mockResponse);

      const result = await controller.getPurchaseHistory(
        mockRequest as any,
        queryDto,
      );

      expect(result).toEqual(mockResponse);
      expect(historyService.getPurchaseHistory).toHaveBeenCalledWith(
        'user123',
        queryDto,
      );
    });
  });

  describe('searchHistory', () => {
    it('should return search results', async () => {
      const mockRequest = { user: { id: 'user123' } };
      const searchDto = new SearchHistoryDto();
      searchDto.query = 'test';
      const mockResponse: HistoryResponseDto = {
        purchases: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };

      mockHistoryService.searchPurchaseHistory.mockResolvedValue(mockResponse);

      const result = await controller.searchHistory(
        mockRequest as any,
        searchDto,
      );

      expect(result).toEqual(mockResponse);
      expect(historyService.searchPurchaseHistory).toHaveBeenCalledWith(
        'user123',
        searchDto,
      );
    });
  });

  describe('getPurchaseDetails', () => {
    it('should return purchase details', async () => {
      const mockRequest = { user: { id: 'user123' } };
      const purchaseId = 'purchase123';
      const mockPurchase = new PurchaseHistory();
      mockPurchase.id = purchaseId;
      mockPurchase.userId = 'user123';

      mockHistoryService.getPurchaseDetails.mockResolvedValue(mockPurchase);

      const result = await controller.getPurchaseDetails(
        mockRequest as any,
        purchaseId,
      );

      expect(result).toEqual(mockPurchase);
      expect(historyService.getPurchaseDetails).toHaveBeenCalledWith(
        'user123',
        purchaseId,
      );
    });
  });

  describe('createPurchaseRecord', () => {
    it('should create a purchase record', async () => {
      const createDto: AddGameToLibraryDto = {
        userId: 'user123',
        gameId: 'game123',
        orderId: 'order123',
        purchaseId: 'purchase123',
        purchasePrice: 59.99,
        currency: 'RUB',
        purchaseDate: '2024-01-15T10:30:00Z',
      };
      const mockPurchase = new PurchaseHistory();
      mockPurchase.id = createDto.purchaseId;
      mockPurchase.userId = createDto.userId;
      mockPurchase.gameId = createDto.gameId;

      mockHistoryService.createPurchaseRecord.mockResolvedValue(mockPurchase);

      const result = await controller.createPurchaseRecord(createDto);

      expect(result).toEqual(mockPurchase);
      expect(historyService.createPurchaseRecord).toHaveBeenCalledWith(
        createDto,
      );
    });
  });
});
