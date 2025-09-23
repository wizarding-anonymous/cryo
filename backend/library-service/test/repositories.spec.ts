import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LibraryGame } from '../src/library/entities/library-game.entity';
import { PurchaseHistory } from '../src/history/entities/purchase-history.entity';
import { TestAppModule } from './test-app.module';

describe('Repository Layer', () => {
  let module: TestingModule;
  let libraryRepository: Repository<LibraryGame>;
  let historyRepository: Repository<PurchaseHistory>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    libraryRepository = module.get<Repository<LibraryGame>>(
      getRepositoryToken(LibraryGame),
    );
    historyRepository = module.get<Repository<PurchaseHistory>>(
      getRepositoryToken(PurchaseHistory),
    );
  });

  afterAll(async () => {
    await module.close();
  });

  it('should inject LibraryGame repository', () => {
    expect(libraryRepository).toBeDefined();
  });

  it('should inject PurchaseHistory repository', () => {
    expect(historyRepository).toBeDefined();
  });

  it('should have methods like find, findOne, save, etc.', () => {
    expect(libraryRepository.find).toBeInstanceOf(Function);
    expect(libraryRepository.findOne).toBeInstanceOf(Function);
    expect(libraryRepository.save).toBeInstanceOf(Function);
    expect(historyRepository.find).toBeInstanceOf(Function);
    expect(historyRepository.findOne).toBeInstanceOf(Function);
    expect(historyRepository.save).toBeInstanceOf(Function);
  });
});
