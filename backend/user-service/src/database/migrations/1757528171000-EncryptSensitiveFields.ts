import { MigrationInterface, QueryRunner } from 'typeorm';

export class EncryptSensitiveFields1757528171000 implements MigrationInterface {
  name = 'EncryptSensitiveFields1757528171000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, drop the GIN indexes on JSONB columns
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_users_preferences_gin"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_users_privacy_settings_gin"
    `);

    // Change preferences column from jsonb to text for encrypted storage
    await queryRunner.query(`
      ALTER TABLE "users" 
      ALTER COLUMN "preferences" TYPE text
    `);

    // Change privacy_settings column from jsonb to text for encrypted storage
    await queryRunner.query(`
      ALTER TABLE "users" 
      ALTER COLUMN "privacy_settings" TYPE text
    `);

    // Add comments to indicate these fields are encrypted
    await queryRunner.query(`
      COMMENT ON COLUMN "users"."preferences" IS 'Encrypted user preferences data'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "users"."privacy_settings" IS 'Encrypted privacy settings data'
    `);

    // Create new indexes for text columns (for searching encrypted data we don't need GIN)
    // We can create simple indexes for NULL checks
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_preferences_not_null" 
      ON "users" ("preferences") 
      WHERE "preferences" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_privacy_settings_not_null" 
      ON "users" ("privacy_settings") 
      WHERE "privacy_settings" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the text-based indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_users_preferences_not_null"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_users_privacy_settings_not_null"
    `);

    // Remove comments
    await queryRunner.query(`
      COMMENT ON COLUMN "users"."preferences" IS NULL
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "users"."privacy_settings" IS NULL
    `);

    // Change back to jsonb (this will lose encrypted data)
    await queryRunner.query(`
      ALTER TABLE "users" 
      ALTER COLUMN "preferences" TYPE jsonb USING preferences::jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "users" 
      ALTER COLUMN "privacy_settings" TYPE jsonb USING privacy_settings::jsonb
    `);

    // Recreate the original GIN indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_preferences_gin" 
      ON "users" USING GIN ("preferences") 
      WHERE "preferences" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_privacy_settings_gin" 
      ON "users" USING GIN ("privacy_settings") 
      WHERE "privacy_settings" IS NOT NULL
    `);
  }
}