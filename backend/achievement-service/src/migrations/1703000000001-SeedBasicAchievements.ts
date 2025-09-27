import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedBasicAchievements1703000000001 implements MigrationInterface {
  name = 'SeedBasicAchievements1703000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert basic achievements for MVP
    await queryRunner.query(`
      INSERT INTO achievements (name, description, type, condition, "iconUrl", points, "isActive") VALUES
      (
        'Первая покупка',
        'Поздравляем с первой покупкой игры на нашей платформе!',
        'first_purchase',
        '{"type": "first_time"}',
        '/icons/achievements/first-purchase.svg',
        100,
        true
      ),
      (
        'Первый отзыв',
        'Спасибо за ваш первый отзыв! Ваше мнение важно для сообщества.',
        'first_review',
        '{"type": "first_time"}',
        '/icons/achievements/first-review.svg',
        50,
        true
      ),
      (
        'Первый друг',
        'Отлично! Вы добавили своего первого друга на платформе.',
        'first_friend',
        '{"type": "first_time"}',
        '/icons/achievements/first-friend.svg',
        75,
        true
      ),
      (
        'Коллекционер игр',
        'У вас уже 5 игр в библиотеке! Продолжайте собирать коллекцию.',
        'games_purchased',
        '{"type": "count", "target": 5, "field": "games_count"}',
        '/icons/achievements/game-collector.svg',
        200,
        true
      ),
      (
        'Активный критик',
        'Вы написали уже 10 отзывов! Ваши рецензии помогают другим игрокам.',
        'reviews_written',
        '{"type": "count", "target": 10, "field": "reviews_count"}',
        '/icons/achievements/active-critic.svg',
        300,
        true
      ),
      (
        'Библиотекарь',
        'Впечатляющая коллекция! У вас уже 20 игр в библиотеке.',
        'games_purchased',
        '{"type": "threshold", "target": 20, "field": "games_count"}',
        '/icons/achievements/librarian.svg',
        500,
        true
      ),
      (
        'Эксперт-рецензент',
        'Невероятно! Вы написали уже 25 отзывов. Настоящий эксперт!',
        'reviews_written',
        '{"type": "threshold", "target": 25, "field": "reviews_count"}',
        '/icons/achievements/expert-reviewer.svg',
        750,
        true
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove seeded achievements
    await queryRunner.query(`
      DELETE FROM achievements WHERE name IN (
        'Первая покупка',
        'Первый отзыв',
        'Первый друг',
        'Коллекционер игр',
        'Активный критик',
        'Библиотекарь',
        'Эксперт-рецензент'
      )
    `);
  }
}
