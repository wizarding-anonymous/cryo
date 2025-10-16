import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLastLoginAtToUsers1757528168000 implements MigrationInterface {
  name = 'AddLastLoginAtToUsers1757528168000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "last_login_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_login_at"`);
  }
}
