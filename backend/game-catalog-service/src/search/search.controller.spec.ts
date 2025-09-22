import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';
import { HttpException, HttpStatus } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchGamesDto } from '../dto/search-games.dto';
import { PerformanceInterceptor } from '../common/interceptors/performance.interceptor';
import { PerformanceMonitoringService } from '../common/services/performance-monitoring.service';
import { HttpCacheInterceptor } from '../common/interceptors/http-cache.interceptor';

const mockSearchService = {
  searchGames: jest.fn(),
};

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockPerformanceMonitoringService = {
  recordEndpointMetrics: jest.fn(),
};

describe('SearchController', () => {
  let controller: SearchController;
  let service: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        {
          provide: SearchService,
          useValue: mockSearchService,
        },
        {
          provide: PerformanceInterceptor,
          useValue: {},
        },
        {
          provide: PerformanceMonitoringService,
          useValue: mockPerformanceMonitoringService,
        },
        {
          provide: HttpCacheInterceptor,
          useValue: {},
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<SearchController>(SearchController);
    service = module.get<SearchService>(SearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('searchGames', () => {
    const mockGameListResponse = {
      games: [],
      total: 0,
      page: 1,
      limit: 10,
      hasNext: false,
    };

    it('should call searchService.searchGames with the correct query', async () => {
      const searchGamesDto: SearchGamesDto = { q: 'test', page: 1, limit: 10 };
      mockSearchService.searchGames.mockResolvedValue(mockGameListResponse);

      const result = await controller.searchGames(searchGamesDto);
      
      expect(service.searchGames).toHaveBeenCalledWith(searchGamesDto);
      expect(result).toEqual(mockGameListResponse);
    });

    it('should handle search without query parameter', async () => {
      const searchGamesDto: SearchGamesDto = { page: 1, limit: 10 };
      mockSearchService.searchGames.mockResolvedValue(mockGameListResponse);

      const result = await controller.searchGames(searchGamesDto);
      
      expect(service.searchGames).toHaveBeenCalledWith(searchGamesDto);
      expect(result).toEqual(mockGameListResponse);
    });

    it('should throw BadRequestException for empty search query', async () => {
      const searchGamesDto: SearchGamesDto = { q: '   ', page: 1, limit: 10 };

      await expect(controller.searchGames(searchGamesDto)).rejects.toThrow(
        new HttpException('Search query cannot be empty', HttpStatus.BAD_REQUEST)
      );
      
      expect(service.searchGames).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when minPrice > maxPrice', async () => {
      const searchGamesDto: SearchGamesDto = { 
        q: 'test', 
        page: 1, 
        limit: 10, 
        minPrice: 1000, 
        maxPrice: 500 
      };

      await expect(controller.searchGames(searchGamesDto)).rejects.toThrow(
        new HttpException('Minimum price cannot be greater than maximum price', HttpStatus.BAD_REQUEST)
      );
      
      expect(service.searchGames).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for negative minPrice', async () => {
      const searchGamesDto: SearchGamesDto = { 
        q: 'test', 
        page: 1, 
        limit: 10, 
        minPrice: -100 
      };

      await expect(controller.searchGames(searchGamesDto)).rejects.toThrow(
        new HttpException('Minimum price cannot be negative', HttpStatus.BAD_REQUEST)
      );
      
      expect(service.searchGames).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for negative maxPrice', async () => {
      const searchGamesDto: SearchGamesDto = { 
        q: 'test', 
        page: 1, 
        limit: 10, 
        maxPrice: -500 
      };

      await expect(controller.searchGames(searchGamesDto)).rejects.toThrow(
        new HttpException('Maximum price cannot be negative', HttpStatus.BAD_REQUEST)
      );
      
      expect(service.searchGames).not.toHaveBeenCalled();
    });

    it('should handle valid price range filters', async () => {
      const searchGamesDto: SearchGamesDto = { 
        q: 'test', 
        page: 1, 
        limit: 10, 
        minPrice: 100, 
        maxPrice: 1000 
      };
      mockSearchService.searchGames.mockResolvedValue(mockGameListResponse);

      const result = await controller.searchGames(searchGamesDto);
      
      expect(service.searchGames).toHaveBeenCalledWith(searchGamesDto);
      expect(result).toEqual(mockGameListResponse);
    });

    it('should handle different search types', async () => {
      const searchGamesDto: SearchGamesDto = { 
        q: 'test', 
        page: 1, 
        limit: 10, 
        searchType: 'description' 
      };
      mockSearchService.searchGames.mockResolvedValue(mockGameListResponse);

      const result = await controller.searchGames(searchGamesDto);
      
      expect(service.searchGames).toHaveBeenCalledWith(searchGamesDto);
      expect(result).toEqual(mockGameListResponse);
    });

    it('should throw InternalServerErrorException when service throws unexpected error', async () => {
      const searchGamesDto: SearchGamesDto = { q: 'test', page: 1, limit: 10 };
      mockSearchService.searchGames.mockRejectedValue(new Error('Database connection failed'));

      await expect(controller.searchGames(searchGamesDto)).rejects.toThrow(
        new HttpException('Search operation failed', HttpStatus.INTERNAL_SERVER_ERROR)
      );
      
      expect(service.searchGames).toHaveBeenCalledWith(searchGamesDto);
    });

    it('should re-throw HttpException from service', async () => {
      const searchGamesDto: SearchGamesDto = { q: 'test', page: 1, limit: 10 };
      const httpException = new HttpException('Service error', HttpStatus.BAD_REQUEST);
      mockSearchService.searchGames.mockRejectedValue(httpException);

      await expect(controller.searchGames(searchGamesDto)).rejects.toThrow(httpException);
      
      expect(service.searchGames).toHaveBeenCalledWith(searchGamesDto);
    });
  });
});
