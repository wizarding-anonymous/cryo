import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedBasicAchievements1703000000001 implements MigrationInterface {
  name = 'SeedBasicAchievements1703000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert basic achievements for MVP
    await queryRunner.query(`
      INSERT INTO achievements (id, name, description, type, condition, "iconUrl", points, "isActive", "createdAt", "updatedAt") VALUES
      (
        gen_random_uuid(),
        'Первая покупка',
        'Поздравляем с первой покупкой игры на нашей платформе! Добро пожаловать в мир игр!',
        'first_purchase',
        '{"type": "first_time"}',
        '/icons/achievements/first-purchase.svg',
        100,
        true,
        NOW(),
        NOW()
      ),
      (
        gen_random_uuid(),
        'Первый отзыв',
        'Спасибо за ваш первый отзыв! Ваше мнение важно для сообщества игроков.',
        'first_review',
        '{"type": "first_time"}',
        '/icons/achievements/first-review.svg',
        50,
        true,
        NOW(),
        NOW()
      ),
      (
        gen_random_uuid(),
        'Первый друг',
        'Отлично! Вы добавили своего первого друга на платформе. Игры веселее с друзьями!',
        'first_friend',
        '{"type": "first_time"}',
        '/icons/achievements/first-friend.svg',
        75,
        true,
        NOW(),
        NOW()
      ),
      (
        gen_random_uuid(),
        'Коллекционер игр',
        'У вас уже 5 игр в библиотеке! Продолжайте собирать коллекцию.',
        'games_purchased',
        '{"type": "count", "target": 5, "field": "games_count"}',
        '/icons/achievements/game-collector.svg',
        200,
        true,
        NOW(),
        NOW()
      ),
      (
        gen_random_uuid(),
        'Активный критик',
        'Вы написали уже 10 отзывов! Ваши рецензии помогают другим игрокам делать правильный выбор.',
        'reviews_written',
        '{"type": "count", "target": 10, "field": "reviews_count"}',
        '/icons/achievements/active-critic.svg',
        300,
        true,
        NOW(),
        NOW()
      ),
      (
        gen_random_uuid(),
        'Библиотекарь',
        'Впечатляющая коллекция! У вас уже 20 игр в библиотеке. Настоящий ценитель игр!',
        'games_purchased',
        '{"type": "threshold", "target": 20, "field": "games_count"}',
        '/icons/achievements/librarian.svg',
        500,
        true,
        NOW(),
        NOW()
      ),
      (
        gen_random_uuid(),
        'Эксперт-рецензент',
        'Невероятно! Вы написали уже 25 отзывов. Настоящий эксперт в мире игр!',
        'reviews_written',
        '{"type": "threshold", "target": 25, "field": "reviews_count"}',
        '/icons/achievements/expert-reviewer.svg',
        750,
        true,
        NOW(),
        NOW()
      ),
      (
        gen_random_uuid(),
        'Социальная бабочка',
        'У вас уже 5 друзей на платформе! Вы создаете настоящее игровое сообщество.',
        'first_friend',
        '{"type": "count", "target": 5, "field": "friends_count"}',
        '/icons/achievements/social-butterfly.svg',
        150,
        true,
        NOW(),
        NOW()
      ),
      (
        gen_random_uuid(),
        'Начинающий рецензент',
        'Вы написали свои первые 3 отзыва! Продолжайте делиться впечатлениями.',
        'reviews_written',
        '{"type": "count", "target": 3, "field": "reviews_count"}',
        '/icons/achievements/beginner-reviewer.svg',
        100,
        true,
        NOW(),
        NOW()
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
        'Эксперт-рецензент',
        'Социальная бабочка',
        'Начинающий рецензент'
      )
    `);
  }
}
