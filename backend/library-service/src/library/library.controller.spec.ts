import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';
import { SearchService } from './search.service';
import {
  LibraryQueryDto,
  SearchLibraryDto,
  LibraryResponseDto,
  OwnershipResponseDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { InternalAuthGuard } from '../auth/guards/internal-auth.guard';

describe('LibraryController', () => {
  let controller: LibraryController;
  let libraryService: LibraryService;
  let searchService: SearchService;

  const mockLibraryService = {
    getUserLibrary: jest.fn(),
    checkGameOwnership: jest.fn(),
    addGameToLibrary: jest.fn(),
    removeGameFromLibrary: jest.fn(),
  };

  const mockSearchService = {
    searchUserLibrary: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LibraryController],
      providers: [
        { provide: LibraryService, useValue: mockLibraryService },
        { provide: SearchService, useValue: mockSearchService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JwtAuthGuard, useValue: { canActivate: () => true } },
        { provide: OwnershipGuard, useValue: { canActivate: () => true } },
        { provide: InternalAuthGuard, useValue: { canActivate: () => true } },
        {
          provide: 'CACHE_MANAGER',
          useValue: { get: jest.fn(), set: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<LibraryController>(LibraryController);
    libraryService = module.get<LibraryService>(LibraryService);
    searchService = module.get<SearchService>(SearchService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMyLibrary', () => {
    it('should return user library', async () => {
      const mockRequest = { user: { id: 'user123' } };
      const queryDto = new LibraryQueryDto();
      const mockResponse: LibraryResponseDto = {
        games: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };

      mockLibraryService.getUserLibrary.mockResolvedValue(mockResponse);

      const result = await controller.getMyLibrary(
        mockRequest as any,
        queryDto,
      );

      expect(result).toEqual(mockResponse);
      expect(libraryService.getUserLibrary).toHaveBeenCalledWith(
        'user123',
        queryDto,
      );
    });
  });

  describe('searchMyLibrary', () => {
    it('should return search results', async () => {
      const mockRequest = { user: { id: 'user123' } };
      const searchDto = new SearchLibraryDto();
      searchDto.query = 'test';
      const mockResponse: LibraryResponseDto = {
        games: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };

      mockSearchService.searchUserLibrary.mockResolvedValue(mockResponse);

      const result = await controller.searchMyLibrary(
        mockRequest as any,
        searchDto,
      );

      expect(result).toEqual(mockResponse);
      expect(searchService.searchUserLibrary).toHaveBeenCalledWith(
        'user123',
        searchDto,
      );
    });
  });

  describe('checkOwnership', () => {
    it('should return ownership status', async () => {
      const mockRequest = { user: { id: 'user123' } };
      const gameId = 'game123';
      const mockResponse: OwnershipResponseDto = {
        owns: true,
        purchaseDate: new Date(),
        purchasePrice: 29.99,
        currency: 'USD',
      };

      mockLibraryService.checkGameOwnership.mockResolvedValue(mockResponse);

      const result = await controller.checkOwnership(
        mockRequest as any,
        gameId,
      );

      expect(result).toEqual(mockResponse);
      expect(libraryService.checkGameOwnership).toHaveBeenCalledWith(
        'user123',
        gameId,
      );
    });
  });
});
