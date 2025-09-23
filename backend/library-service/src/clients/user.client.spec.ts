import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { UserServiceClient } from './user.client';

describe('UserServiceClient', () => {
  let client: UserServiceClient;
  let httpService: HttpService;

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'services.user.url') {
        return 'http://fake-user-service';
      }
      return undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserServiceClient,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    client = module.get<UserServiceClient>(UserServiceClient);
    httpService = module.get<HttpService>(HttpService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(client).toBeDefined();
  });

  describe('doesUserExist', () => {
    it('should return true when user exists', async () => {
      const mockResponse: AxiosResponse = {
        data: { exists: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await client.doesUserExist('user123');
      expect(result).toBe(true);
      expect(httpService.get).toHaveBeenCalledTimes(1);
      expect(httpService.get).toHaveBeenCalledWith('http://fake-user-service/users/user123/exists');
    });

    it('should return false when user does not exist', async () => {
      const mockResponse: AxiosResponse = {
        data: { exists: false },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await client.doesUserExist('user123');
      expect(result).toBe(false);
    });

    it('should return false on error after retries', async () => {
      const error = new Error('Network error');
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const result = await client.doesUserExist('user123');
      expect(result).toBe(false);
      expect(httpService.get).toHaveBeenCalledWith('http://fake-user-service/users/user123/exists');
    });

    it('should handle malformed response', async () => {
      const mockResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await client.doesUserExist('user123');
      expect(result).toBe(false);
    });

    it('should handle non-boolean exists value', async () => {
      const mockResponse: AxiosResponse = {
        data: { exists: 'true' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await client.doesUserExist('user123');
      expect(result).toBe(false);
    });
  });
});
