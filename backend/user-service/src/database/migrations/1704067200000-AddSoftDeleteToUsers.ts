import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDeleteToUsers1704067200000 implements MigrationInterface {
  name = 'AddSoftDeleteToUsers1704067200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deleted_at"`);
  }
}