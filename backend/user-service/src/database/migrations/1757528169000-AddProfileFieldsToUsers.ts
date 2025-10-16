import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfileFieldsToUsers1757528169000
  implements MigrationInterface
{
  name = 'AddProfileFieldsToUsers1757528169000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new profile fields to users table
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN "avatar_url" varchar(500),
      ADD COLUMN "preferences" jsonb,
      ADD COLUMN "privacy_settings" jsonb,
      ADD COLUMN "is_active" boolean NOT NULL DEFAULT true,
      ADD COLUMN "metadata" jsonb
    `);

    // Create index for is_active field for performance
    await queryRunner.query(`
      CREATE INDEX "user_is_active_idx" ON "users" ("is_active")
    `);

    // Set default values for existing users
    await queryRunner.query(`
      UPDATE "users" 
      SET "is_active" = true 
      WHERE "is_active" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the index first
    await queryRunner.query(`DROP INDEX "user_is_active_idx"`);

    // Remove the added columns
    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP COLUMN "metadata",
      DROP COLUMN "privacy_settings",
      DROP COLUMN "preferences",
      DROP COLUMN "avatar_url",
      DROP COLUMN "is_active"
    `);
  }
}
