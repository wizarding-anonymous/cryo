import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { GameCatalogClient } from '../src/clients/game-catalog.client';
import { UserServiceClient } from '../src/clients/user.client';
import { AxiosResponse } from 'axios';

describe('HTTP Clients', () => {
  let gameCatalogClient: GameCatalogClient;
  let userServiceClient: UserServiceClient;
  let httpService: HttpService;

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'services.gamesCatalog.url') return 'http://game-catalog';
      if (key === 'services.user.url') return 'http://user-service';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameCatalogClient,
        UserServiceClient,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    gameCatalogClient = module.get<GameCatalogClient>(GameCatalogClient);
    userServiceClient = module.get<UserServiceClient>(UserServiceClient);
    httpService = module.get<HttpService>(HttpService);
  });

  describe('GameCatalogClient', () => {
    it('should call getGamesByIds with correct URL', async () => {
      const response: AxiosResponse = { data: { games: [] }, status: 200, statusText: 'OK', headers: {}, config: {} as any };
      mockHttpService.get.mockReturnValue(of(response));

      await gameCatalogClient.getGamesByIds(['1', '2']);
      expect(httpService.get).toHaveBeenCalledWith('http://game-catalog/internal/games/batch?ids=1,2');
    });

    it('should call doesGameExist with correct URL', async () => {
      const response: AxiosResponse = { data: { exists: true }, status: 200, statusText: 'OK', headers: {}, config: {} as any };
      mockHttpService.get.mockReturnValue(of(response));

      await gameCatalogClient.doesGameExist('game1');
      expect(httpService.get).toHaveBeenCalledWith('http://game-catalog/internal/games/game1/exists');
    });
  });

  describe('UserServiceClient', () => {
    it('should call doesUserExist with correct URL', async () => {
      const response: AxiosResponse = { data: { exists: true }, status: 200, statusText: 'OK', headers: {}, config: {} as any };
      mockHttpService.get.mockReturnValue(of(response));

      await userServiceClient.doesUserExist('user1');
      expect(httpService.get).toHaveBeenCalledWith('http://user-service/users/user1/exists');
    });
  });
});
