import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { LibraryRepository } from './library.repository';
import { LibraryGame } from '../entities/library-game.entity';
import { LibraryQueryDto, SortBy } from '../dto/request.dto';

describe('LibraryRepository', () => {
  let repository: LibraryRepository;
  let typeormRepository: Repository<LibraryGame>;

  const mockTypeormRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
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

  describe('findUserLibrary', () => {
    it('returns user library with pagination', async () => {
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
      expect(typeormRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          order: { purchaseDate: 'DESC' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('maps price sort to purchasePrice column', async () => {
      const userId = 'user123';
      const queryDto = new LibraryQueryDto();
      queryDto.sortBy = SortBy.PRICE;
      queryDto.sortOrder = 'asc';

      mockTypeormRepository.findAndCount.mockResolvedValue([[], 0]);

      await repository.findUserLibrary(userId, queryDto);

      expect(typeormRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { purchasePrice: 'ASC' },
        }),
      );
    });

    it('maps developer sort to gameId column', async () => {
      const userId = 'user123';
      const queryDto = new LibraryQueryDto();
      queryDto.sortBy = SortBy.DEVELOPER;
      queryDto.sortOrder = 'asc';

      mockTypeormRepository.findAndCount.mockResolvedValue([[], 0]);

      await repository.findUserLibrary(userId, queryDto);

      expect(typeormRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { gameId: 'ASC' },
        }),
      );
    });

    it('maps title sort to gameId column', async () => {
      const userId = 'user123';
      const queryDto = new LibraryQueryDto();
      queryDto.sortBy = SortBy.TITLE;
      queryDto.sortOrder = 'desc';

      mockTypeormRepository.findAndCount.mockResolvedValue([[], 0]);

      await repository.findUserLibrary(userId, queryDto);

      expect(typeormRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { gameId: 'DESC' },
        }),
      );
    });

    it('falls back to purchaseDate when sortBy is undefined', async () => {
      const userId = 'user123';
      const queryDto = new LibraryQueryDto();
      queryDto.sortBy = undefined;
      queryDto.sortOrder = undefined;

      mockTypeormRepository.findAndCount.mockResolvedValue([[], 0]);

      await repository.findUserLibrary(userId, queryDto);

      expect(typeormRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { purchaseDate: 'DESC' },
        }),
      );
    });
  });

  describe('findOneByUserIdAndGameId', () => {
    it('returns game when found', async () => {
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

    it('returns null when game not found', async () => {
      mockTypeormRepository.findOne.mockResolvedValue(null);

      const result = await repository.findOneByUserIdAndGameId('user123', 'game456');

      expect(result).toBeNull();
    });
  });

  describe('findUserLibraryWithLatestPurchase', () => {
    it('builds left join to latest purchase and paginates/sorts', async () => {
      const userId = 'user123';
      const queryDto = new LibraryQueryDto();
      queryDto.page = 1;
      queryDto.limit = 5;
      queryDto.sortBy = SortBy.PURCHASE_DATE;
      queryDto.sortOrder = 'desc';

      const qb: Partial<SelectQueryBuilder<any>> = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      mockTypeormRepository.createQueryBuilder.mockReturnValue(qb);
      mockTypeormRepository.count.mockResolvedValue(0);

      const result = await repository.findUserLibraryWithLatestPurchase(userId, queryDto);

      expect(result).toEqual([[], 0]);
      expect(mockTypeormRepository.createQueryBuilder).toHaveBeenCalledWith('lg');
      expect(qb.leftJoin).toHaveBeenCalled();
      expect(qb.where).toHaveBeenCalledWith('lg."userId" = :userId', { userId });
      expect(qb.orderBy).toHaveBeenCalledWith('lg."purchaseDate"', 'DESC');
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(5);
      expect(qb.select).toHaveBeenCalled();
      expect(qb.getRawMany).toHaveBeenCalled();
      expect(mockTypeormRepository.count).toHaveBeenCalledWith({ where: { userId } });
    });
  });
});
