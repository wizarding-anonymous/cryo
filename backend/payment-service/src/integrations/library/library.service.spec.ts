import { Test, TestingModule } from '@nestjs/testing';
import { LibraryIntegrationService } from './library.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AddGameToLibraryDto } from './dto/add-game-to-library.dto';

describe('LibraryIntegrationService', () => {
  let service: LibraryIntegrationService;
  let httpService: HttpService;

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://mock-library-url'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LibraryIntegrationService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<LibraryIntegrationService>(LibraryIntegrationService);
    httpService = module.get<HttpService>(HttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addGameToLibrary', () => {
    const payload: AddGameToLibraryDto = {
      userId: 'user-id',
      gameId: 'game-id',
      orderId: 'order-id',
      purchasePrice: 100,
      currency: 'RUB',
    };

    it('should return true on successful request', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 201 }));
      const result = await service.addGameToLibrary(payload);
      expect(result).toBe(true);
      expect(httpService.post).toHaveBeenCalledTimes(1);
    });

    it('should retry 3 times on failure and then return false', async () => {
      mockHttpService.post.mockReturnValue(throwError(() => new Error('Service Unavailable')));
      const result = await service.addGameToLibrary(payload);
      expect(result).toBe(false);
      // The initial call + 3 retries = 4 total calls
      expect(httpService.post).toHaveBeenCalledTimes(4);
    });

    it('should return false if status is not 201', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 500 }));
      const result = await service.addGameToLibrary(payload);
      expect(result).toBe(false);
    });
  });
});
