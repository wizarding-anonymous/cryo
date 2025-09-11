import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchGamesDto } from '../dto/search-games.dto';

const mockSearchService = {
  searchGames: jest.fn(),
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
      ],
    }).compile();

    controller = module.get<SearchController>(SearchController);
    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('searchGames', () => {
    it('should call searchService.searchGames with the correct query', async () => {
      const searchGamesDto: SearchGamesDto = { q: 'test', page: 1, limit: 10 };
      mockSearchService.searchGames.mockResolvedValue({ games: [], total: 0, page: 1, limit: 10, hasNext: false });

      await controller.searchGames(searchGamesDto);
      expect(service.searchGames).toHaveBeenCalledWith(searchGamesDto);
    });
  });
});
