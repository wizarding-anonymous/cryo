import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchService } from './search.service';
import { LibraryGame } from './entities/library-game.entity';
import { SearchLibraryDto } from './dto/request.dto';

describe('SearchService', () => {
  let service: SearchService;
  let repository: Repository<LibraryGame>;

  const mockLibraryRepository = {
    findAndCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: getRepositoryToken(LibraryGame),
          useValue: mockLibraryRepository,
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    repository = module.get<Repository<LibraryGame>>(getRepositoryToken(LibraryGame));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchUserLibrary', () => {
    it('should call the repository with correct search parameters', async () => {
      const searchDto = new SearchLibraryDto();
      searchDto.query = 'test';
      searchDto.page = 1;
      searchDto.limit = 10;

      mockLibraryRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.searchUserLibrary('user1', searchDto);

      expect(mockLibraryRepository.findAndCount).toHaveBeenCalledWith({
        where: {
          userId: 'user1',
        },
        skip: 0,
        take: 10,
        order: { [searchDto.sortBy]: searchDto.sortOrder },
      });
    });
  });
});
