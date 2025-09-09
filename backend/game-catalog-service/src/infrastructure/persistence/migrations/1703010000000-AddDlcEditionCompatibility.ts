import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDlcEditionCompatibility1703010000000 implements MigrationInterface {
  name = 'AddDlcEditionCompatibility1703010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "dlc_edition_compatibilities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "dlcId" uuid NOT NULL,
        "editionId" uuid NOT NULL,
        CONSTRAINT "PK_dlc_edition_compatibilities" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "dlc_edition_compatibilities"
      ADD CONSTRAINT "FK_compat_dlc"
      FOREIGN KEY ("dlcId") REFERENCES "dlcs"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "dlc_edition_compatibilities"
      ADD CONSTRAINT "FK_compat_edition"
      FOREIGN KEY ("editionId") REFERENCES "game_editions"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "dlc_edition_compatibilities"`);
  }
}
