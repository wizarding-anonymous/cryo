import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSeasonPass1703009000000 implements MigrationInterface {
  name = 'AddSeasonPass1703009000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create season_passes table
    await queryRunner.query(`
      CREATE TABLE "season_passes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" text,
        "price" numeric(10,2) NOT NULL,
        "gameId" uuid NOT NULL,
        CONSTRAINT "PK_season_passes" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_season_passes_game" ON "season_passes" ("gameId")`);
    await queryRunner.query(`
        ALTER TABLE "season_passes"
        ADD CONSTRAINT "FK_season_passes_game"
        FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE
    `);

    // Create season_pass_dlcs junction table
    await queryRunner.query(`
        CREATE TABLE "season_pass_dlcs" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "seasonPassId" uuid NOT NULL,
          "dlcId" uuid NOT NULL,
          CONSTRAINT "PK_season_pass_dlcs" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`
        ALTER TABLE "season_pass_dlcs"
        ADD CONSTRAINT "FK_season_pass_dlcs_pass"
        FOREIGN KEY ("seasonPassId") REFERENCES "season_passes"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
        ALTER TABLE "season_pass_dlcs"
        ADD CONSTRAINT "FK_season_pass_dlcs_dlc"
        FOREIGN KEY ("dlcId") REFERENCES "dlcs"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "season_pass_dlcs"`);
    await queryRunner.query(`DROP TABLE "season_passes"`);
  }
}
