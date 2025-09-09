import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRatingToGames1703005000000 implements MigrationInterface {
  name = 'AddRatingToGames1703005000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "games"
      ADD COLUMN "average_rating" numeric(3,2) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "games"
      ADD COLUMN "reviews_count" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_games_average_rating" ON "games" ("average_rating" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_games_average_rating"`);
    await queryRunner.query(`ALTER TABLE "games" DROP COLUMN "reviews_count"`);
    await queryRunner.query(`ALTER TABLE "games" DROP COLUMN "average_rating"`);
  }
}
