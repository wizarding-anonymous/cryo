import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { UserServiceClient } from './user.client';

describe('UserServiceClient', () => {
  let client: UserServiceClient;
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
    it('should return true on success', async () => {
      const mockResponse = { data: { exists: true } };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await client.doesUserExist('1');
      expect(result).toBe(true);
      expect(httpService.get).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually return false', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('test error')));

      const result = await client.doesUserExist('1');
      expect(result).toBe(false);
      expect(httpService.get).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });
  });
});
