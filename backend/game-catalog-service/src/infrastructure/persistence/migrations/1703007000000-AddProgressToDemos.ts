import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProgressToDemos1703007000000 implements MigrationInterface {
  name = 'AddProgressToDemos1703007000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "demos"
      ADD COLUMN "progress" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "demos"
      ADD COLUMN "conversion_count" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "demos" DROP COLUMN "conversion_count"`);
    await queryRunner.query(`ALTER TABLE "demos" DROP COLUMN "progress"`);
  }
}
