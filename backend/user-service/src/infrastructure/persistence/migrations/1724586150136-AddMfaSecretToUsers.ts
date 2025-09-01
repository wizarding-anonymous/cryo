import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMfaSecretToUsers1724586150136 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "users" ADD COLUMN "mfa_secret" VARCHAR(255) NULL;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "users" DROP COLUMN "mfa_secret";
        `);
  }
}
