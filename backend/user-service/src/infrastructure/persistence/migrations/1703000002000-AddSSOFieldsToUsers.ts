import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSSOFieldsToUsers1703000002000 implements MigrationInterface {
  name = 'AddSSOFieldsToUsers1703000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN "first_name" varchar(100),
      ADD COLUMN "last_name" varchar(100),
      ADD COLUMN "created_via_sso" boolean DEFAULT false,
      ADD COLUMN "sso_provider_id" varchar(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP COLUMN "first_name",
      DROP COLUMN "last_name", 
      DROP COLUMN "created_via_sso",
      DROP COLUMN "sso_provider_id"
    `);
  }
}
