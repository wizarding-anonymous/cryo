import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateReviewAndGameRatingTables1727302800000 implements MigrationInterface {
  name = 'CreateReviewAndGameRatingTables1727302800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create reviews table
    await queryRunner.createTable(
      new Table({
        name: 'reviews',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'userId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'gameId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'text',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'rating',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes for reviews table
    await queryRunner.createIndex('reviews', new TableIndex({
      name: 'IDX_REVIEWS_GAME_ID',
      columnNames: ['gameId'],
    }));

    await queryRunner.createIndex('reviews', new TableIndex({
      name: 'IDX_REVIEWS_USER_ID',
      columnNames: ['userId'],
    }));

    await queryRunner.createIndex('reviews', new TableIndex({
      name: 'IDX_REVIEWS_GAME_USER_UNIQUE',
      columnNames: ['gameId', 'userId'],
      isUnique: true,
    }));

    // Create game_ratings table
    await queryRunner.createTable(
      new Table({
        name: 'game_ratings',
        columns: [
          {
            name: 'gameId',
            type: 'varchar',
            isPrimary: true,
          },
          {
            name: 'averageRating',
            type: 'decimal',
            precision: 3,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'totalReviews',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first
    await queryRunner.dropIndex('reviews', 'IDX_REVIEWS_GAME_USER_UNIQUE');
    await queryRunner.dropIndex('reviews', 'IDX_REVIEWS_USER_ID');
    await queryRunner.dropIndex('reviews', 'IDX_REVIEWS_GAME_ID');
    
    // Drop tables
    await queryRunner.dropTable('game_ratings');
    await queryRunner.dropTable('reviews');
  }
}