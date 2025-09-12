import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LibraryService } from './library.service';
import { LibraryGame } from './entities/library-game.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { LibraryQueryDto, AddGameToLibraryDto } from './dto/request.dto';

describe('LibraryService', () => {
  let service: LibraryService;
  let repository: Repository<LibraryGame>;

  const mockLibraryRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LibraryService,
        {
          provide: getRepositoryToken(LibraryGame),
          useValue: mockLibraryRepository,
        },
      ],
    }).compile();

    service = module.get<LibraryService>(LibraryService);
    repository = module.get<Repository<LibraryGame>>(getRepositoryToken(LibraryGame));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserLibrary', () => {
    it('should return a paginated list of games', async () => {
      const mockGames = [{ id: '1', userId: 'user1', gameId: 'game1' }];
      mockLibraryRepository.findAndCount.mockResolvedValue([mockGames, 1]);

      const queryDto = new LibraryQueryDto();
      queryDto.page = 1;
      queryDto.limit = 10;

      const result = await service.getUserLibrary('user1', queryDto);

      expect(result.games).toEqual(mockGames);
      expect(result.pagination.total).toBe(1);
      expect(mockLibraryRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: 'user1' },
        skip: 0,
        take: 10,
        order: { [queryDto.sortBy]: queryDto.sortOrder },
      });
    });
  });

  describe('addGameToLibrary', () => {
    it('should add a game to the library', async () => {
      const dto: AddGameToLibraryDto = {
        userId: 'user1',
        gameId: 'game1',
        orderId: 'order1',
        purchaseId: 'purchase1',
        purchasePrice: 10.0,
        currency: 'USD',
        purchaseDate: new Date().toISOString(),
      };
      const newGame = new LibraryGame();

      mockLibraryRepository.findOne.mockResolvedValue(null);
      mockLibraryRepository.create.mockReturnValue(newGame);
      mockLibraryRepository.save.mockResolvedValue(newGame);

      const result = await service.addGameToLibrary(dto);
      expect(result).toEqual(newGame);
      expect(mockLibraryRepository.save).toHaveBeenCalledWith(newGame);
    });

    it('should throw a ConflictException if the game is already in the library', async () => {
      const dto: AddGameToLibraryDto = {
        userId: 'user1',
        gameId: 'game1',
        orderId: 'order1',
        purchaseId: 'purchase1',
        purchasePrice: 10.0,
        currency: 'USD',
        purchaseDate: new Date().toISOString(),
      };
      mockLibraryRepository.findOne.mockResolvedValue(new LibraryGame());

      await expect(service.addGameToLibrary(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('checkGameOwnership', () => {
    it('should return true if the user owns the game', async () => {
      mockLibraryRepository.findOne.mockResolvedValue(new LibraryGame());
      const result = await service.checkGameOwnership('user1', 'game1');
      expect(result.owns).toBe(true);
    });

    it('should return false if the user does not own the game', async () => {
      mockLibraryRepository.findOne.mockResolvedValue(null);
      const result = await service.checkGameOwnership('user1', 'game1');
      expect(result.owns).toBe(false);
    });
  });

  describe('removeGameFromLibrary', () => {
    it('should remove a game from the library', async () => {
      mockLibraryRepository.delete.mockResolvedValue({ affected: 1 });
      await expect(service.removeGameFromLibrary('user1', 'game1')).resolves.toBeUndefined();
    });

    it('should throw a NotFoundException if the game is not in the library', async () => {
      mockLibraryRepository.delete.mockResolvedValue({ affected: 0 });
      await expect(service.removeGameFromLibrary('user1', 'game1')).rejects.toThrow(NotFoundException);
    });
  });
});
