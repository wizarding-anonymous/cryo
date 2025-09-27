import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Achievement, AchievementType } from '../achievement/entities/achievement.entity';
import { SeedBasicAchievements1703000000001 } from './1703000000001-SeedBasicAchievements';

describe('SeedBasicAchievements Migration', () => {
  let dataSource: DataSource;
  let migration: SeedBasicAchievements1703000000001;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5433'),
          username: process.env.DB_USERNAME || 'postgres',
          password: process.env.DB_PASSWORD || 'password',
          database: process.env.DB_NAME || 'achievement_service_test',
          entities: [Achievement],
          synchronize: true,
          dropSchema: true,
        }),
      ],
    }).compile();

    dataSource = module.get<DataSource>(DataSource);
    migration = new SeedBasicAchievements1703000000001();
  }, 30000);

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe('Migration Up', () => {
    it('should seed all basic achievements', async () => {
      // Run the migration
      await migration.up(dataSource.createQueryRunner());

      // Verify achievements were created
      const achievements = await dataSource.getRepository(Achievement).find();

      expect(achievements).toHaveLength(9);

      // Verify required achievements exist
      const achievementNames = achievements.map(a => a.name);
      expect(achievementNames).toContain('Первая покупка');
      expect(achievementNames).toContain('Первый отзыв');
      expect(achievementNames).toContain('Первый друг');
      expect(achievementNames).toContain('Коллекционер игр');
      expect(achievementNames).toContain('Активный критик');
    }, 10000);

    it('should create achievements with correct condition types', async () => {
      const achievements = await dataSource.getRepository(Achievement).find();

      // Check first_time achievements
      const firstTimeAchievements = achievements.filter(a => a.condition.type === 'first_time');
      expect(firstTimeAchievements).toHaveLength(3);

      // Check count achievements
      const countAchievements = achievements.filter(a => a.condition.type === 'count');
      expect(countAchievements).toHaveLength(4);

      // Check threshold achievements
      const thresholdAchievements = achievements.filter(a => a.condition.type === 'threshold');
      expect(thresholdAchievements).toHaveLength(2);
    }, 10000);

    it('should assign appropriate points to achievements', async () => {
      const achievements = await dataSource.getRepository(Achievement).find();

      // Verify points are assigned
      achievements.forEach(achievement => {
        expect(achievement.points).toBeGreaterThan(0);
        expect(achievement.points).toBeLessThanOrEqual(1000);
      });

      // Verify first purchase has 100 points
      const firstPurchase = achievements.find(a => a.name === 'Первая покупка');
      expect(firstPurchase?.points).toBe(100);

      // Verify expert reviewer has highest points
      const expertReviewer = achievements.find(a => a.name === 'Эксперт-рецензент');
      expect(expertReviewer?.points).toBe(750);
    }, 10000);

    it('should create achievements with proper icons and descriptions', async () => {
      const achievements = await dataSource.getRepository(Achievement).find();

      achievements.forEach(achievement => {
        // All achievements should have descriptions
        expect(achievement.description).toBeTruthy();
        expect(achievement.description.length).toBeGreaterThan(10);

        // All achievements should have icon URLs
        expect(achievement.iconUrl).toBeTruthy();
        expect(achievement.iconUrl).toMatch(/^\/icons\/achievements\/.*\.svg$/);

        // All achievements should be active
        expect(achievement.isActive).toBe(true);
      });
    }, 10000);

    it('should create achievements with valid types', async () => {
      const achievements = await dataSource.getRepository(Achievement).find();

      const validTypes = Object.values(AchievementType);

      achievements.forEach(achievement => {
        expect(validTypes).toContain(achievement.type);
      });
    }, 10000);
  });

  describe('Migration Down', () => {
    it('should remove all seeded achievements', async () => {
      // First ensure achievements exist
      let achievements = await dataSource.getRepository(Achievement).find();
      expect(achievements.length).toBeGreaterThan(0);

      // Run the down migration
      await migration.down(dataSource.createQueryRunner());

      // Verify achievements were removed
      achievements = await dataSource.getRepository(Achievement).find();
      expect(achievements).toHaveLength(0);
    }, 10000);
  });

  describe('Achievement Conditions Validation', () => {
    beforeEach(async () => {
      await migration.up(dataSource.createQueryRunner());
    });

    afterEach(async () => {
      await migration.down(dataSource.createQueryRunner());
    });

    it('should have valid condition structures for first_time achievements', async () => {
      const achievements = await dataSource.getRepository(Achievement).find({
        where: { type: AchievementType.FIRST_PURCHASE },
      });

      const firstPurchase = achievements[0];
      expect(firstPurchase.condition).toEqual({ type: 'first_time' });
    }, 10000);

    it('should have valid condition structures for count achievements', async () => {
      const achievements = await dataSource.getRepository(Achievement).find();
      const gameCollector = achievements.find(a => a.name === 'Коллекционер игр');

      expect(gameCollector?.condition).toEqual({
        type: 'count',
        target: 5,
        field: 'games_count',
      });
    }, 10000);

    it('should have valid condition structures for threshold achievements', async () => {
      const achievements = await dataSource.getRepository(Achievement).find();
      const librarian = achievements.find(a => a.name === 'Библиотекарь');

      expect(librarian?.condition).toEqual({
        type: 'threshold',
        target: 20,
        field: 'games_count',
      });
    }, 10000);
  });
});
