import { DataSource } from 'typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { GameRepository } from '../../src/infrastructure/persistence/game.repository';
import { Game, GameStatus } from '../../src/domain/entities/game.entity';
import { Category } from '../../src/domain/entities/category.entity';
import { Tag } from '../../src/domain/entities/tag.entity';
import { Screenshot } from '../../src/domain/entities/screenshot.entity';
import { Video } from '../../src/domain/entities/video.entity';
import { Discount } from '../../src/domain/entities/discount.entity';
import { SystemRequirements } from '../../src/domain/entities/system-requirements.entity';
import { GameTranslation } from '../../src/domain/entities/game-translation.entity';
import { Dlc } from '../../src/domain/entities/dlc.entity';
import { Preorder } from '../../src/domain/entities/preorder.entity';
import { PreorderTier } from '../../src/domain/entities/preorder-tier.entity';
import { Demo } from '../../src/domain/entities/demo.entity';
import { GameEdition } from '../../src/domain/entities/game-edition.entity';
import { Bundle } from '../../src/domain/entities/bundle.entity';
import { Franchise } from '../../src/domain/entities/franchise.entity';
import { InitialSchema1703001000000 } from '../../src/infrastructure/persistence/migrations/1703001000000-InitialSchema';
import { AddConstraintsAndIndexes1703002000000 } from '../../src/infrastructure/persistence/migrations/1703002000000-AddConstraintsAndIndexes';
import { DbOptimizations1703003000000 } from '../../src/infrastructure/persistence/migrations/1703003000000-DbOptimizations';

describe('GameRepository Integration Test', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let gameRepository: GameRepository;

  beforeAll(async () => {
    // Start the PostgreSQL container
    container = await new PostgreSqlContainer().start();

    // Create a new DataSource instance with the container's connection details
    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      database: container.getDatabase(),
      username: container.getUsername(),
      password: container.getPassword(),
      entities: [
        Game, Category, Tag, Screenshot, Video, Discount, SystemRequirements,
        GameTranslation, Dlc, Preorder, PreorderTier, Demo, GameEdition, Bundle, Franchise
      ],
      migrations: [InitialSchema1703001000000, AddConstraintsAndIndexes1703002000000, DbOptimizations1703003000000],
      migrationsRun: true, // Automatically run migrations
      synchronize: false,
    });

    await dataSource.initialize();

    // Instantiate the repository with the test data source
    gameRepository = new GameRepository(dataSource);
  }, 30000); // 30 second timeout for container startup

  afterAll(async () => {
    await dataSource.destroy();
    await container.stop();
  });

  it('should create a new game and find it by id', async () => {
    // Arrange
    const newGame = new Game();
    newGame.title = 'Test Game for Integration Test';
    newGame.slug = 'test-game-integration';
    newGame.developerId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    newGame.status = GameStatus.DRAFT;
    newGame.price = 29.99;
    newGame.isFree = false;

    // Act
    const createdGame = await gameRepository.create(newGame);
    const foundGame = await gameRepository.findById(createdGame.id);

    // Assert
    expect(foundGame).toBeDefined();
    expect(foundGame.id).toEqual(createdGame.id);
    expect(foundGame.title).toEqual('Test Game for Integration Test');
  });

  it('should return null when finding a non-existent game', async () => {
    // Act
    const foundGame = await gameRepository.findById('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99'); // Non-existent UUID

    // Assert
    expect(foundGame).toBeNull();
  });
});
