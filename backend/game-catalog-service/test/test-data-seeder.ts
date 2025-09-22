import { DataSource, Repository } from 'typeorm';
import { Game } from '../src/entities/game.entity';

export interface TestGameData {
  title: string;
  description?: string;
  shortDescription?: string;
  price: number;
  currency?: string;
  genre: string;
  developer: string;
  publisher?: string;
  releaseDate?: Date;
  images?: string[];
  systemRequirements?: {
    minimum: string;
    recommended: string;
  };
  available?: boolean;
}

export class TestDataSeeder {
  private gameRepository: Repository<Game>;

  constructor(private dataSource: DataSource) {
    this.gameRepository = dataSource.getRepository(Game);
  }

  /**
   * Seed a comprehensive set of test games for various test scenarios
   */
  async seedComprehensiveTestData(): Promise<Game[]> {
    const testGames: TestGameData[] = [
      // Popular AAA Games
      {
        title: 'Cyberpunk 2077',
        description: 'An open-world, action-adventure story set in Night City, a megalopolis obsessed with power, glamour and body modification.',
        shortDescription: 'Futuristic open-world RPG',
        price: 2999.99,
        currency: 'RUB',
        genre: 'RPG',
        developer: 'CD Projekt RED',
        publisher: 'CD Projekt',
        releaseDate: new Date('2020-12-10'),
        images: ['cyberpunk1.jpg', 'cyberpunk2.jpg', 'cyberpunk3.jpg'],
        systemRequirements: {
          minimum: 'OS: Windows 10 64-bit, Processor: Intel Core i5-3570K or AMD FX-8310, Memory: 8 GB RAM',
          recommended: 'OS: Windows 10 64-bit, Processor: Intel Core i7-4790 or AMD Ryzen 3 3200G, Memory: 12 GB RAM'
        },
        available: true,
      },
      {
        title: 'The Witcher 3: Wild Hunt',
        description: 'A story-driven, next-generation open world role-playing game set in a visually stunning fantasy universe.',
        shortDescription: 'Epic fantasy RPG adventure',
        price: 1499.99,
        currency: 'RUB',
        genre: 'RPG',
        developer: 'CD Projekt RED',
        publisher: 'CD Projekt',
        releaseDate: new Date('2015-05-19'),
        images: ['witcher3_1.jpg', 'witcher3_2.jpg'],
        systemRequirements: {
          minimum: 'OS: Windows 7 64-bit, Processor: Intel CPU Core i5-2500K 3.3GHz, Memory: 6 GB RAM',
          recommended: 'OS: Windows 10 64-bit, Processor: Intel CPU Core i7 3770 3.4 GHz, Memory: 8 GB RAM'
        },
        available: true,
      },
      // Competitive Games
      {
        title: 'Counter-Strike 2',
        description: 'The premier competitive FPS experience, featuring updated graphics and gameplay mechanics.',
        shortDescription: 'Competitive tactical shooter',
        price: 0,
        currency: 'RUB',
        genre: 'FPS',
        developer: 'Valve Corporation',
        publisher: 'Valve Corporation',
        releaseDate: new Date('2023-09-27'),
        images: ['cs2_1.jpg', 'cs2_2.jpg'],
        systemRequirements: {
          minimum: 'OS: Windows 10, Processor: 4 hardware CPU threads - Intel Core i5 750 or higher, Memory: 8 GB RAM',
          recommended: 'OS: Windows 10, Processor: 4+ hardware CPU threads - Intel Core i5 750 or higher, Memory: 8 GB RAM'
        },
        available: true,
      },
      {
        title: 'Dota 2',
        description: 'The most-played game on Steam. Every day, millions of players worldwide enter battle as one of over a hundred Dota heroes.',
        shortDescription: 'MOBA with deep strategy',
        price: 0,
        currency: 'RUB',
        genre: 'MOBA',
        developer: 'Valve Corporation',
        publisher: 'Valve Corporation',
        releaseDate: new Date('2013-07-09'),
        images: ['dota2_1.jpg', 'dota2_2.jpg'],
        systemRequirements: {
          minimum: 'OS: Windows 7 or newer, Processor: Dual core from Intel or AMD at 2.8 GHz, Memory: 4 GB RAM',
          recommended: 'OS: Windows 10, Processor: Dual core from Intel or AMD at 2.8 GHz, Memory: 8 GB RAM'
        },
        available: true,
      },
      // Indie Games
      {
        title: 'Hollow Knight',
        description: 'Forge your own path in Hollow Knight! An epic action adventure through a vast ruined kingdom of insects and heroes.',
        shortDescription: 'Atmospheric metroidvania',
        price: 899.99,
        currency: 'RUB',
        genre: 'Metroidvania',
        developer: 'Team Cherry',
        publisher: 'Team Cherry',
        releaseDate: new Date('2017-02-24'),
        images: ['hollow_knight_1.jpg'],
        systemRequirements: {
          minimum: 'OS: Windows 7, Processor: Intel Core 2 Duo E5200, Memory: 4 GB RAM',
          recommended: 'OS: Windows 10, Processor: Intel Core i5, Memory: 8 GB RAM'
        },
        available: true,
      },
      {
        title: 'Celeste',
        description: 'Help Madeline survive her inner demons on her journey to the top of Celeste Mountain.',
        shortDescription: 'Challenging platformer',
        price: 1199.99,
        currency: 'RUB',
        genre: 'Platformer',
        developer: 'Maddy Makes Games',
        publisher: 'Maddy Makes Games',
        releaseDate: new Date('2018-01-25'),
        images: ['celeste_1.jpg'],
        systemRequirements: {
          minimum: 'OS: Windows 7, Processor: Intel Core i3 M380, Memory: 2 GB RAM',
          recommended: 'OS: Windows 10, Processor: Intel Core i5-750, Memory: 4 GB RAM'
        },
        available: true,
      },
      // Strategy Games
      {
        title: 'Civilization VI',
        description: 'Build an empire to stand the test of time in the ultimate turn-based strategy experience.',
        shortDescription: 'Turn-based strategy empire builder',
        price: 3999.99,
        currency: 'RUB',
        genre: 'Strategy',
        developer: 'Firaxis Games',
        publisher: '2K Games',
        releaseDate: new Date('2016-10-21'),
        images: ['civ6_1.jpg', 'civ6_2.jpg'],
        systemRequirements: {
          minimum: 'OS: Windows 7 64bit / 8.1 64bit / 10 64bit, Processor: Intel Core i3 2.5 Ghz or AMD Phenom II 2.6 Ghz, Memory: 4 GB RAM',
          recommended: 'OS: Windows 7 64bit / 8.1 64bit / 10 64bit, Processor: Fourth Generation Intel Core i5 2.5 Ghz or AMD FX8350 4.0 Ghz, Memory: 8 GB RAM'
        },
        available: true,
      },
      // Racing Games
      {
        title: 'Forza Horizon 5',
        description: 'Your Ultimate Horizon Adventure awaits! Explore the vibrant and ever-evolving open world landscapes of Mexico.',
        shortDescription: 'Open-world racing adventure',
        price: 4999.99,
        currency: 'RUB',
        genre: 'Racing',
        developer: 'Playground Games',
        publisher: 'Xbox Game Studios',
        releaseDate: new Date('2021-11-09'),
        images: ['forza5_1.jpg', 'forza5_2.jpg'],
        systemRequirements: {
          minimum: 'OS: Windows 10 version 15063.0, Processor: Intel i5-4460 or AMD Ryzen 3 1200, Memory: 8 GB RAM',
          recommended: 'OS: Windows 10 version 15063.0, Processor: Intel i5-8400 or AMD Ryzen 5 1500X, Memory: 16 GB RAM'
        },
        available: true,
      },
      // Simulation Games
      {
        title: 'Cities: Skylines',
        description: 'Cities: Skylines is a modern take on the classic city simulation.',
        shortDescription: 'City building simulation',
        price: 1999.99,
        currency: 'RUB',
        genre: 'Simulation',
        developer: 'Colossal Order Ltd.',
        publisher: 'Paradox Interactive',
        releaseDate: new Date('2015-03-10'),
        images: ['cities_skylines_1.jpg'],
        systemRequirements: {
          minimum: 'OS: Microsoft Windows XP/Vista/7/8/8.1 (64-bit), Processor: Intel Core 2 Duo, 3.0GHz or AMD Athlon 64 X2 6400+, 3.2GHz, Memory: 4 GB RAM',
          recommended: 'OS: Microsoft Windows 7/8 (64-bit), Processor: Intel Core i5-3470, 3.20GHz or AMD FX-6300, 3.5Ghz, Memory: 6 GB RAM'
        },
        available: true,
      },
      // Horror Games
      {
        title: 'Phasmophobia',
        description: 'Phasmophobia is a 4 player online co-op psychological horror where you and your team investigate haunted locations.',
        shortDescription: 'Co-op ghost hunting horror',
        price: 899.99,
        currency: 'RUB',
        genre: 'Horror',
        developer: 'Kinetic Games',
        publisher: 'Kinetic Games',
        releaseDate: new Date('2020-09-18'),
        images: ['phasmophobia_1.jpg'],
        systemRequirements: {
          minimum: 'OS: Windows 10 64Bit, Processor: Intel Core i5-4590 / AMD FX 8350, Memory: 8 GB RAM',
          recommended: 'OS: Windows 10 64Bit, Processor: Intel i5-4590/AMD Ryzen 5 2600, Memory: 8 GB RAM'
        },
        available: true,
      },
      // Unavailable/Delisted Games
      {
        title: 'Delisted Test Game',
        description: 'A game that has been removed from sale for testing purposes.',
        shortDescription: 'Unavailable test game',
        price: 2999.99,
        currency: 'RUB',
        genre: 'Test',
        developer: 'Test Studio',
        publisher: 'Test Publisher',
        releaseDate: new Date('2020-01-01'),
        images: ['delisted_1.jpg'],
        systemRequirements: {
          minimum: 'Test minimum requirements',
          recommended: 'Test recommended requirements'
        },
        available: false,
      },
      // Free Games
      {
        title: 'Free Test Game',
        description: 'A completely free game for testing free-to-play scenarios.',
        shortDescription: 'Free-to-play test game',
        price: 0,
        currency: 'RUB',
        genre: 'Free-to-Play',
        developer: 'Free Studio',
        publisher: 'Free Publisher',
        releaseDate: new Date('2023-01-01'),
        images: ['free_game_1.jpg'],
        systemRequirements: {
          minimum: 'Very low system requirements',
          recommended: 'Low system requirements'
        },
        available: true,
      },
      // High-priced Premium Games
      {
        title: 'Premium Collector Edition',
        description: 'An expensive premium game for testing high-price scenarios.',
        shortDescription: 'Premium collector edition',
        price: 9999.99,
        currency: 'RUB',
        genre: 'Premium',
        developer: 'Premium Studio',
        publisher: 'Premium Publisher',
        releaseDate: new Date('2024-01-01'),
        images: ['premium_1.jpg', 'premium_2.jpg', 'premium_3.jpg'],
        systemRequirements: {
          minimum: 'High-end system requirements',
          recommended: 'Ultra high-end system requirements'
        },
        available: true,
      },
      // Games with special characters
      {
        title: 'Тест Игра (Test Game)',
        description: 'A game with Cyrillic characters for internationalization testing.',
        shortDescription: 'Международная тестовая игра',
        price: 1999.99,
        currency: 'RUB',
        genre: 'Тест',
        developer: 'Тест Студия',
        publisher: 'Test Publisher',
        releaseDate: new Date('2023-06-01'),
        images: ['cyrillic_game_1.jpg'],
        systemRequirements: {
          minimum: 'Минимальные системные требования',
          recommended: 'Рекомендуемые системные требования'
        },
        available: true,
      },
      // Games for search testing
      {
        title: 'Adventure Quest Chronicles',
        description: 'An epic adventure game with quests and exploration.',
        shortDescription: 'Epic adventure with quests',
        price: 2499.99,
        currency: 'RUB',
        genre: 'Adventure',
        developer: 'Adventure Studios',
        publisher: 'Quest Publishers',
        releaseDate: new Date('2023-03-15'),
        images: ['adventure_quest_1.jpg'],
        systemRequirements: {
          minimum: 'Standard adventure game requirements',
          recommended: 'Enhanced adventure game requirements'
        },
        available: true,
      },
    ];

    const savedGames = await this.gameRepository.save(testGames);
    console.log(`Seeded ${savedGames.length} comprehensive test games`);
    return savedGames;
  }

  /**
   * Seed minimal test data for basic testing
   */
  async seedMinimalTestData(): Promise<Game[]> {
    const minimalGames: TestGameData[] = [
      {
        title: 'Basic Test Game 1',
        price: 29.99,
        genre: 'Action',
        developer: 'Test Studio 1',
        available: true,
      },
      {
        title: 'Basic Test Game 2',
        price: 49.99,
        genre: 'RPG',
        developer: 'Test Studio 2',
        available: true,
      },
      {
        title: 'Unavailable Test Game',
        price: 19.99,
        genre: 'Strategy',
        developer: 'Test Studio 3',
        available: false,
      },
    ];

    const savedGames = await this.gameRepository.save(minimalGames);
    console.log(`Seeded ${savedGames.length} minimal test games`);
    return savedGames;
  }

  /**
   * Seed performance test data with many games
   */
  async seedPerformanceTestData(count: number = 100): Promise<Game[]> {
    const performanceGames: TestGameData[] = [];

    for (let i = 1; i <= count; i++) {
      performanceGames.push({
        title: `Performance Test Game ${i}`,
        description: `Description for performance test game number ${i}`,
        shortDescription: `Performance game ${i}`,
        price: Math.round((Math.random() * 100 + 1) * 100) / 100, // Random price between 1-100
        currency: 'RUB',
        genre: ['Action', 'RPG', 'Strategy', 'Simulation', 'Racing'][i % 5],
        developer: `Performance Studio ${Math.ceil(i / 10)}`,
        publisher: `Performance Publisher ${Math.ceil(i / 20)}`,
        releaseDate: new Date(2020 + (i % 4), (i % 12), (i % 28) + 1),
        images: [`perf_game_${i}_1.jpg`],
        systemRequirements: {
          minimum: `Minimum requirements for game ${i}`,
          recommended: `Recommended requirements for game ${i}`
        },
        available: i % 10 !== 0, // Every 10th game is unavailable
      });
    }

    const savedGames = await this.gameRepository.save(performanceGames);
    console.log(`Seeded ${savedGames.length} performance test games`);
    return savedGames;
  }

  /**
   * Seed search-specific test data
   */
  async seedSearchTestData(): Promise<Game[]> {
    const searchGames: TestGameData[] = [
      {
        title: 'Unique Search Title Game',
        description: 'This game has a very unique title for search testing',
        price: 39.99,
        genre: 'Unique',
        developer: 'Unique Studios',
        available: true,
      },
      {
        title: 'Common Word Game',
        description: 'A game with common words in the description for search testing',
        price: 29.99,
        genre: 'Common',
        developer: 'Common Studios',
        available: true,
      },
      {
        title: 'Developer Search Test',
        description: 'Testing search by developer name',
        price: 19.99,
        genre: 'Test',
        developer: 'SearchableDeveloper',
        available: true,
      },
      {
        title: 'Genre Search Game',
        description: 'Testing search by genre',
        price: 24.99,
        genre: 'SearchableGenre',
        developer: 'Genre Studios',
        available: true,
      },
    ];

    const savedGames = await this.gameRepository.save(searchGames);
    console.log(`Seeded ${savedGames.length} search test games`);
    return savedGames;
  }

  /**
   * Clean all test data
   */
  async cleanAllTestData(): Promise<void> {
    await this.gameRepository.clear();
    console.log('Cleaned all test data');
  }

  /**
   * Clean specific test games by title pattern
   */
  async cleanTestDataByPattern(titlePattern: string): Promise<void> {
    const games = await this.gameRepository
      .createQueryBuilder('game')
      .where('game.title LIKE :pattern', { pattern: `%${titlePattern}%` })
      .getMany();

    if (games.length > 0) {
      await this.gameRepository.remove(games);
      console.log(`Cleaned ${games.length} test games matching pattern: ${titlePattern}`);
    }
  }

  /**
   * Get test game by title
   */
  async getTestGameByTitle(title: string): Promise<Game | null> {
    return await this.gameRepository.findOne({ where: { title } });
  }

  /**
   * Get all test games
   */
  async getAllTestGames(): Promise<Game[]> {
    return await this.gameRepository.find();
  }

  /**
   * Get test games count
   */
  async getTestGamesCount(): Promise<number> {
    return await this.gameRepository.count();
  }
}