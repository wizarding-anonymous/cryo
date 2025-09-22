import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptimizeGameIndexes1703000000000 implements MigrationInterface {
  name = 'OptimizeGameIndexes1703000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create composite indexes for better query performance
    
    // Index for games list with availability and genre filtering
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_games_available_genre" 
      ON "games" ("available", "genre") 
      WHERE "available" = true
    `);

    // Index for games list with availability and price filtering
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_games_available_price" 
      ON "games" ("available", "price") 
      WHERE "available" = true
    `);

    // Index for games list with availability and release date (for default sorting)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_games_available_release_date" 
      ON "games" ("available", "release_date" DESC) 
      WHERE "available" = true
    `);

    // Composite index for search with price filtering
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_games_search_price" 
      ON "games" ("available", "price", "release_date" DESC) 
      WHERE "available" = true
    `);

    // Full-text search index for Russian language (if not exists)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_games_title_search_ru" 
      ON "games" USING gin(to_tsvector('russian', "title"))
    `);

    // Full-text search index for description (Russian)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_games_description_search_ru" 
      ON "games" USING gin(to_tsvector('russian', COALESCE("description", '')))
    `);

    // Combined full-text search index for all searchable fields
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_games_fulltext_search_ru" 
      ON "games" USING gin(to_tsvector('russian', 
        "title" || ' ' || 
        COALESCE("description", '') || ' ' || 
        COALESCE("short_description", '')
      ))
    `);

    // Index for frequently accessed game details by ID and availability
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_games_id_available" 
      ON "games" ("id", "available")
    `);

    // Update table statistics for better query planning
    await queryRunner.query(`ANALYZE "games"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the indexes in reverse order
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_games_id_available"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_games_fulltext_search_ru"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_games_description_search_ru"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_games_title_search_ru"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_games_search_price"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_games_available_release_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_games_available_price"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_games_available_genre"`);
  }
}