import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { GameCatalogClient } from './game-catalog.client';

describe('GameCatalogClient', () => {
  let client: GameCatalogClient;
  let httpService: HttpService;

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://fake-url'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameCatalogClient,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    client = module.get<GameCatalogClient>(GameCatalogClient);
    httpService = module.get<HttpService>(HttpService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(client).toBeDefined();
  });

  describe('getGamesByIds', () => {
    it('should return game details on success', async () => {
      const mockResponse = { data: { games: [{ id: '1', title: 'Game 1' }] } };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await client.getGamesByIds(['1']);
      expect(result).toEqual(mockResponse.data.games);
      expect(httpService.get).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually return empty array', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('test error')));

      const result = await client.getGamesByIds(['1']);
      expect(result).toEqual([]);
      expect(httpService.get).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });
  });
});
