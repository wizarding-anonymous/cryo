import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LibraryRepository } from './library.repository';
import { LibraryGame } from '../entities/library-game.entity';
import { LibraryQueryDto, SortBy } from '../dto/request.dto';

describe('LibraryRepository', () => {
  let repository: LibraryRepository;
  let typeormRepository: Repository<LibraryGame>;

  const mockTypeormRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LibraryRepository,
        {
          provide: getRepositoryToken(LibraryGame),
          useValue: mockTypeormRepository,
        },
      ],
    }).compile();

    repository = module.get<LibraryRepository>(LibraryRepository);
    typeormRepository = module.get<Repository<LibraryGame>>(getRepositoryToken(LibraryGame));
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findUserLibrary', () => {
    it('should return user library with pagination', async () => {
      const userId = 'user123';
      const queryDto = new LibraryQueryDto();
      queryDto.page = 1;
      queryDto.limit = 20;
      queryDto.sortBy = SortBy.PURCHASE_DATE;
      queryDto.sortOrder = 'desc';

      const mockGames = [new LibraryGame()];
      const mockCount = 1;

      mockTypeormRepository.findAndCount.mockResolvedValue([mockGames, mockCount]);

      const result = await repository.findUserLibrary(userId, queryDto);

      expect(result).toEqual([mockGames, mockCount]);
      expect(typeormRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId },
        order: { purchaseDate: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should handle different sort options', async () => {
      const userId = 'user123';
      const queryDto = new LibraryQueryDto();
      queryDto.sortBy = SortBy.PRICE;
      queryDto.sortOrder = 'asc';

      mockTypeormRepository.findAndCount.mockResolvedValue([[], 0]);

      await repository.findUserLibrary(userId, queryDto);

      expect(typeormRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId },
        order: { price: 'asc' },
        skip: 0,
        take: 20,
      });
    });
  });

  describe('findOneByUserIdAndGameId', () => {
    it('should find game by user and game ID', async () => {
      const userId = 'user123';
      const gameId = 'game456';
      const mockGame = new LibraryGame();

      mockTypeormRepository.findOne.mockResolvedValue(mockGame);

      const result = await repository.findOneByUserIdAndGameId(userId, gameId);

      expect(result).toEqual(mockGame);
      expect(typeormRepository.findOne).toHaveBeenCalledWith({
        where: { userId, gameId },
      });
    });

    it('should return null if game not found', async () => {
      const userId = 'user123';
      const gameId = 'game456';

      mockTypeormRepository.findOne.mockResolvedValue(null);

      const result = await repository.findOneByUserIdAndGameId(userId, gameId);

      expect(result).toBeNull();
    });
  });
});