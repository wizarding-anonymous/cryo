import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStatusToPreorders1703006000000 implements MigrationInterface {
  name = 'AddStatusToPreorders1703006000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "preorder_status_enum" AS ENUM('active', 'fulfilled', 'cancelled')
    `);
    await queryRunner.query(`
      ALTER TABLE "preorders"
      ADD COLUMN "status" "preorder_status_enum" NOT NULL DEFAULT 'active'
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_preorders_status" ON "preorders" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_preorders_status"`);
    await queryRunner.query(`ALTER TABLE "preorders" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "preorder_status_enum"`);
  }
}
