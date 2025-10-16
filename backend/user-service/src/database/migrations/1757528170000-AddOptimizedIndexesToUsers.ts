import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOptimizedIndexesToUsers1757528170000
  implements MigrationInterface
{
  name = 'AddOptimizedIndexesToUsers1757528170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pg_trgm extension for trigram matching (if not already enabled)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    // Composite index for active users with last login (for recently active users queries)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_active_last_login" 
      ON "users" ("is_active", "last_login_at" DESC) 
      WHERE "is_active" = true
    `);

    // Composite index for created_at with active status (for user statistics and pagination)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_created_active" 
      ON "users" ("created_at" DESC, "is_active")
    `);

    // Index for email domain queries (for finding users by email domain)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_email_domain" 
      ON "users" (SPLIT_PART("email", '@', 2))
    `);

    // Composite index for updated_at with active status (for cursor pagination by updated_at)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_updated_active" 
      ON "users" ("updated_at" DESC, "is_active")
    `);

    // Index for JSONB preferences queries (for user preference filtering)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_preferences_gin" 
      ON "users" USING GIN ("preferences") 
      WHERE "preferences" IS NOT NULL
    `);

    // Index for JSONB privacy settings queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_privacy_settings_gin" 
      ON "users" USING GIN ("privacy_settings") 
      WHERE "privacy_settings" IS NOT NULL
    `);

    // Composite index for batch operations (id with active status)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_id_active" 
      ON "users" ("id", "is_active")
    `);

    // Index for name searches (for user search functionality)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_name_trgm" 
      ON "users" USING GIN ("name" gin_trgm_ops)
    `);

    // Update table statistics for better query planning
    await queryRunner.query(`ANALYZE "users"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes in reverse order
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_users_name_trgm"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_users_id_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_users_privacy_settings_gin"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_users_preferences_gin"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_users_updated_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_users_email_domain"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_users_deleted_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_users_created_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_users_active_last_login"`,
    );

    // Note: We don't drop the pg_trgm extension as it might be used by other tables
  }
}
