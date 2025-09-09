import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeveloperNameToGames1703004000000 implements MigrationInterface {
  name = 'AddDeveloperNameToGames1703004000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "games"
      ADD COLUMN "developer_name" character varying(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "games"
      ADD COLUMN "publisher_name" character varying(255)
    `);
    // Add default value for existing rows to avoid NOT NULL constraint issues if we were to add it
    await queryRunner.query(`UPDATE "games" SET "developer_name" = 'Unknown Developer' WHERE "developer_name" IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "games" DROP COLUMN "publisher_name"`);
    await queryRunner.query(`ALTER TABLE "games" DROP COLUMN "developer_name"`);
  }
}
