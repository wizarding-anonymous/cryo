import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceOptimizedIndexes1757528173000 implements MigrationInterface {
  name = 'AddPerformanceOptimizedIndexes1757528173000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop old indexes that don't account for deleted_at
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_users_active_last_login"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_users_created_active"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_users_updated_active"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_users_id_active"
    `);

    // Create optimized indexes with deleted_at consideration
    
    // Primary index for active users with last login (most common query)
    await queryRunner.query(`
      CREATE INDEX "idx_users_active_not_deleted_last_login" 
      ON "users" ("is_active", "last_login_at" DESC, "id") 
      WHERE "deleted_at" IS NULL AND "is_active" = true
    `);

    // Index for user statistics and pagination by creation date
    await queryRunner.query(`
      CREATE INDEX "idx_users_created_not_deleted_active" 
      ON "users" ("created_at" DESC, "is_active", "id") 
      WHERE "deleted_at" IS NULL
    `);

    // Index for cursor-based pagination by updated_at
    await queryRunner.query(`
      CREATE INDEX "idx_users_updated_not_deleted_active" 
      ON "users" ("updated_at" DESC, "is_active", "id") 
      WHERE "deleted_at" IS NULL
    `);

    // Optimized index for batch operations (ID lookups)
    await queryRunner.query(`
      CREATE INDEX "idx_users_id_not_deleted_active" 
      ON "users" ("id", "is_active") 
      WHERE "deleted_at" IS NULL
    `);

    // Index specifically for soft-deleted users (cleanup operations)
    await queryRunner.query(`
      CREATE INDEX "idx_users_deleted_at_cleanup" 
      ON "users" ("deleted_at", "updated_at") 
      WHERE "deleted_at" IS NOT NULL
    `);

    // Composite index for email domain analysis (marketing/analytics)
    await queryRunner.query(`
      CREATE INDEX "idx_users_email_domain_active" 
      ON "users" (SPLIT_PART("email", '@', 2), "is_active", "created_at") 
      WHERE "deleted_at" IS NULL
    `);

    // Index for user activity analysis (last login patterns)
    await queryRunner.query(`
      CREATE INDEX "idx_users_last_login_analysis" 
      ON "users" ("last_login_at", "created_at", "is_active") 
      WHERE "deleted_at" IS NULL AND "last_login_at" IS NOT NULL
    `);

    // Partial index for users without last login (never logged in)
    await queryRunner.query(`
      CREATE INDEX "idx_users_never_logged_in" 
      ON "users" ("created_at" DESC, "is_active") 
      WHERE "deleted_at" IS NULL AND "last_login_at" IS NULL
    `);

    // Index for avatar management (users with avatars)
    await queryRunner.query(`
      CREATE INDEX "idx_users_with_avatar" 
      ON "users" ("avatar_url", "updated_at") 
      WHERE "deleted_at" IS NULL AND "avatar_url" IS NOT NULL
    `);

    // Covering index for basic user info (most common SELECT fields)
    await queryRunner.query(`
      CREATE INDEX "idx_users_basic_info_covering" 
      ON "users" ("id") 
      INCLUDE ("email", "name", "is_active", "last_login_at", "created_at", "avatar_url")
      WHERE "deleted_at" IS NULL
    `);

    // Update table statistics for better query planning
    await queryRunner.query(`ANALYZE "users"`);

    // Create partial statistics for better query optimization
    await queryRunner.query(`
      CREATE STATISTICS "users_multi_column_stats" 
      ON "is_active", "deleted_at", "last_login_at" 
      FROM "users"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the new optimized indexes
    await queryRunner.query(`DROP STATISTICS IF EXISTS "users_multi_column_stats"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_basic_info_covering"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_with_avatar"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_never_logged_in"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_last_login_analysis"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_email_domain_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_deleted_at_cleanup"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_id_not_deleted_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_updated_not_deleted_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_created_not_deleted_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_active_not_deleted_last_login"`);

    // Recreate the original indexes (without deleted_at consideration)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_active_last_login" 
      ON "users" ("is_active", "last_login_at" DESC) 
      WHERE "is_active" = true
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_created_active" 
      ON "users" ("created_at" DESC, "is_active")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_updated_active" 
      ON "users" ("updated_at" DESC, "is_active")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_id_active" 
      ON "users" ("id", "is_active")
    `);
  }
}