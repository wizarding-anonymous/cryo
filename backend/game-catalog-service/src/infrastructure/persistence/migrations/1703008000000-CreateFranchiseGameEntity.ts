import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFranchiseGameEntity1703008000000 implements MigrationInterface {
  name = 'CreateFranchiseGameEntity1703008000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old implicit junction table
    await queryRunner.query(`DROP TABLE IF EXISTS "franchise_games"`);

    // Create the new table with the extra column
    await queryRunner.query(`
      CREATE TABLE "franchise_games" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "franchiseId" uuid NOT NULL,
        "gameId" uuid NOT NULL,
        "orderInSeries" integer NOT NULL,
        CONSTRAINT "PK_franchise_games" PRIMARY KEY ("id")
      )
    `);

    // Add foreign keys
    await queryRunner.query(`
      ALTER TABLE "franchise_games"
      ADD CONSTRAINT "FK_franchise_games_franchise"
      FOREIGN KEY ("franchiseId") REFERENCES "franchises"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "franchise_games"
      ADD CONSTRAINT "FK_franchise_games_game"
      FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the new table
    await queryRunner.query(`DROP TABLE "franchise_games"`);

    // Re-create the old implicit junction table
    await queryRunner.query(`
      CREATE TABLE "franchise_games" (
        "franchise_id" uuid NOT NULL,
        "game_id" uuid NOT NULL,
        CONSTRAINT "PK_franchise_games" PRIMARY KEY ("franchise_id", "game_id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "franchise_games"
      ADD CONSTRAINT "FK_franchise_games_franchise"
      FOREIGN KEY ("franchise_id") REFERENCES "franchises"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "franchise_games"
      ADD CONSTRAINT "FK_franchise_games_game"
      FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE
    `);
  }
}
