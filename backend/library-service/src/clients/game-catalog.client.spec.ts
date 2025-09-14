import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { GameCatalogClient } from './game-catalog.client';

describe('GameCatalogClient', () => {
  let client: GameCatalogClient;
  let httpService: HttpService;

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'services.gamesCatalog.url') {
        return 'http://fake-url';
      }
      return undefined;
    }),
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
    it('should return empty array for empty input', async () => {
      const result = await client.getGamesByIds([]);
      expect(result).toEqual([]);
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('should return game details on success', async () => {
      const mockResponse: AxiosResponse = {
        data: { games: [{ id: '1', title: 'Game 1', developer: 'Dev 1', price: 29.99 }] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await client.getGamesByIds(['1']);
      expect(result).toEqual(mockResponse.data.games);
      expect(httpService.get).toHaveBeenCalledTimes(1);
      expect(httpService.get).toHaveBeenCalledWith('http://fake-url/internal/games/batch?ids=1');
    });

    it('should return empty array on error after retries', async () => {
      const error = new Error('Network error');
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const result = await client.getGamesByIds(['1']);
      expect(result).toEqual([]);
      expect(httpService.get).toHaveBeenCalledWith('http://fake-url/internal/games/batch?ids=1');
    });

    it('should handle missing games property in response', async () => {
      const mockResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await client.getGamesByIds(['1']);
      expect(result).toEqual([]);
    });
  });

  describe('doesGameExist', () => {
    it('should return true when game exists', async () => {
      const mockResponse: AxiosResponse = {
        data: { exists: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await client.doesGameExist('1');
      expect(result).toBe(true);
      expect(httpService.get).toHaveBeenCalledWith('http://fake-url/internal/games/1/exists');
    });

    it('should return false when game does not exist', async () => {
      const mockResponse: AxiosResponse = {
        data: { exists: false },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await client.doesGameExist('1');
      expect(result).toBe(false);
    });

    it('should return false on error after retries', async () => {
      const error = new Error('Network error');
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const result = await client.doesGameExist('1');
      expect(result).toBe(false);
      expect(httpService.get).toHaveBeenCalledWith('http://fake-url/internal/games/1/exists');
    });

    it('should handle malformed response data', async () => {
      const mockResponse: AxiosResponse = {
        data: { exists: 'invalid' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await client.doesGameExist('1');
      expect(result).toBe(false);
    });
  });
});
