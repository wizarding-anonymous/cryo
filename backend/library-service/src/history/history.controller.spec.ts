import { Test, TestingModule } from '@nestjs/testing';
import { HistoryController } from './history.controller';
import { HistoryService } from './history.service';
import { HistoryQueryDto, SearchHistoryDto } from './dto/request.dto';
import { HistoryResponseDto } from './dto/response.dto';
import { PurchaseHistory } from './entities/purchase-history.entity';

describe('HistoryController', () => {
  let controller: HistoryController;
  let historyService: HistoryService;

  const mockHistoryService = {
    getPurchaseHistory: jest.fn(),
    getPurchaseDetails: jest.fn(),
    searchPurchaseHistory: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HistoryController],
      providers: [
        { provide: HistoryService, useValue: mockHistoryService },
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
        history: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };

      mockHistoryService.getPurchaseHistory.mockResolvedValue(mockResponse);

      const result = await controller.getPurchaseHistory(mockRequest as any, queryDto);

      expect(result).toEqual(mockResponse);
      expect(historyService.getPurchaseHistory).toHaveBeenCalledWith('user123', queryDto);
    });
  });

  describe('searchHistory', () => {
    it('should return search results', async () => {
      const mockRequest = { user: { id: 'user123' } };
      const searchDto = new SearchHistoryDto();
      searchDto.query = 'test';
      const mockResponse: HistoryResponseDto = {
        history: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };

      mockHistoryService.searchPurchaseHistory.mockResolvedValue(mockResponse);

      const result = await controller.searchHistory(mockRequest as any, searchDto);

      expect(result).toEqual(mockResponse);
      expect(historyService.searchPurchaseHistory).toHaveBeenCalledWith('user123', searchDto);
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

      const result = await controller.getPurchaseDetails(mockRequest as any, purchaseId);

      expect(result).toEqual(mockPurchase);
      expect(historyService.getPurchaseDetails).toHaveBeenCalledWith('user123', purchaseId);
    });
  });
});