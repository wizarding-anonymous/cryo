import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUuidExtension1673000000002 implements MigrationInterface {
  name = 'AddUuidExtension1673000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension if not already enabled
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // We don't drop the extension as it might be used by other services
    // await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp"`);
  }
}