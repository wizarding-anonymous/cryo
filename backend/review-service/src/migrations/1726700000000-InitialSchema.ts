import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1726700000000 implements MigrationInterface {
  name = 'InitialSchema1726700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create reviews table
    await queryRunner.query(`
      CREATE TABLE "reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying(255) NOT NULL,
        "gameId" character varying(255) NOT NULL,
        "text" text NOT NULL,
        "rating" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id")
      )
    `);

    // Create game_ratings table
    await queryRunner.query(`
      CREATE TABLE "game_ratings" (
        "gameId" character varying(255) NOT NULL,
        "averageRating" numeric(3,2) NOT NULL DEFAULT '0',
        "totalReviews" integer NOT NULL DEFAULT '0',
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_game_ratings_gameId" PRIMARY KEY ("gameId")
      )
    `);

    // Create indexes for reviews table
    await queryRunner.query(`
      CREATE INDEX "IDX_reviews_gameId" ON "reviews" ("gameId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_reviews_userId" ON "reviews" ("userId")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_reviews_gameId_userId" ON "reviews" ("gameId", "userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_reviews_gameId_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_reviews_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_reviews_gameId"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "game_ratings"`);
    await queryRunner.query(`DROP TABLE "reviews"`);
  }
}