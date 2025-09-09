import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConstraintsAndIndexes1703002000000 implements MigrationInterface {
    name = 'AddConstraintsAndIndexes1703002000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add foreign key constraints

        // Categories self-reference
        await queryRunner.query(`
      ALTER TABLE "categories" 
      ADD CONSTRAINT "FK_categories_parent" 
      FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL
    `);

        // Preorders -> Games
        await queryRunner.query(`
      ALTER TABLE "preorders" 
      ADD CONSTRAINT "FK_preorders_game" 
      FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE
    `);

        // Preorder tiers -> Preorders
        await queryRunner.query(`
      ALTER TABLE "preorder_tiers" 
      ADD CONSTRAINT "FK_preorder_tiers_preorder" 
      FOREIGN KEY ("preorderId") REFERENCES "preorders"("id") ON DELETE CASCADE
    `);

        // Demos -> Games
        await queryRunner.query(`
      ALTER TABLE "demos" 
      ADD CONSTRAINT "FK_demos_game" 
      FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE
    `);

        // Game editions -> Games
        await queryRunner.query(`
      ALTER TABLE "game_editions" 
      ADD CONSTRAINT "FK_game_editions_game" 
      FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE
    `);

        // DLCs -> Games
        await queryRunner.query(`
      ALTER TABLE "dlcs" 
      ADD CONSTRAINT "FK_dlcs_base_game" 
      FOREIGN KEY ("baseGameId") REFERENCES "games"("id") ON DELETE CASCADE
    `);

        // Screenshots -> Games
        await queryRunner.query(`
      ALTER TABLE "game_screenshots" 
      ADD CONSTRAINT "FK_game_screenshots_game" 
      FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE
    `);

        // Videos -> Games
        await queryRunner.query(`
      ALTER TABLE "game_videos" 
      ADD CONSTRAINT "FK_game_videos_game" 
      FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE
    `);

        // Discounts -> Games
        await queryRunner.query(`
      ALTER TABLE "game_discounts" 
      ADD CONSTRAINT "FK_game_discounts_game" 
      FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE
    `);

        // Translations -> Games
        await queryRunner.query(`
      ALTER TABLE "game_translations" 
      ADD CONSTRAINT "FK_game_translations_game" 
      FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE
    `);

        // Junction table constraints
        await queryRunner.query(`
      ALTER TABLE "game_categories" 
      ADD CONSTRAINT "FK_game_categories_game" 
      FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE
    `);

        await queryRunner.query(`
      ALTER TABLE "game_categories" 
      ADD CONSTRAINT "FK_game_categories_category" 
      FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE
    `);

        await queryRunner.query(`
      ALTER TABLE "game_tags" 
      ADD CONSTRAINT "FK_game_tags_game" 
      FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE
    `);

        await queryRunner.query(`
      ALTER TABLE "game_tags" 
      ADD CONSTRAINT "FK_game_tags_tag" 
      FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE
    `);

        await queryRunner.query(`
      ALTER TABLE "bundle_games" 
      ADD CONSTRAINT "FK_bundle_games_bundle" 
      FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE CASCADE
    `);

        await queryRunner.query(`
      ALTER TABLE "bundle_games" 
      ADD CONSTRAINT "FK_bundle_games_game" 
      FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE
    `);

        await queryRunner.query(`
      ALTER TABLE "franchise_games" 
      ADD CONSTRAINT "FK_franchise_games_franchise" 
      FOREIGN KEY ("franchise_id") REFERENCES "franchises"("id") ON DELETE CASCADE
    `);

        await queryRunner.query(`
      ALTER TABLE "franchise_games" 
      ADD CONSTRAINT "FK_franchise_games_game" 
      FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE
    `);

        // Create performance indexes

        // Games table indexes
        await queryRunner.query(`CREATE INDEX "IDX_games_title" ON "games" ("title")`);
        await queryRunner.query(`CREATE INDEX "IDX_games_slug" ON "games" ("slug")`);
        await queryRunner.query(`CREATE INDEX "IDX_games_status" ON "games" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_games_developer" ON "games" ("developerId")`);
        await queryRunner.query(`CREATE INDEX "IDX_games_publisher" ON "games" ("publisherId")`);
        await queryRunner.query(`CREATE INDEX "IDX_games_release_date" ON "games" ("releaseDate")`);
        await queryRunner.query(`CREATE INDEX "IDX_games_price" ON "games" ("price")`);
        await queryRunner.query(`CREATE INDEX "IDX_games_is_free" ON "games" ("isFree")`);
        await queryRunner.query(`CREATE INDEX "IDX_games_created_at" ON "games" ("createdAt")`);

        // Categories table indexes
        await queryRunner.query(`CREATE INDEX "IDX_categories_name" ON "categories" ("name")`);
        await queryRunner.query(`CREATE INDEX "IDX_categories_slug" ON "categories" ("slug")`);
        await queryRunner.query(`CREATE INDEX "IDX_categories_parent" ON "categories" ("parentId")`);

        // Tags table indexes
        await queryRunner.query(`CREATE INDEX "IDX_tags_name" ON "tags" ("name")`);
        await queryRunner.query(`CREATE INDEX "IDX_tags_slug" ON "tags" ("slug")`);

        // Preorders table indexes
        await queryRunner.query(`CREATE INDEX "IDX_preorders_game" ON "preorders" ("gameId")`);
        await queryRunner.query(`CREATE INDEX "IDX_preorders_start_date" ON "preorders" ("startDate")`);
        await queryRunner.query(`CREATE INDEX "IDX_preorders_release_date" ON "preorders" ("releaseDate")`);
        await queryRunner.query(`CREATE INDEX "IDX_preorders_is_available" ON "preorders" ("isAvailable")`);

        // Preorder tiers table indexes
        await queryRunner.query(`CREATE INDEX "IDX_preorder_tiers_preorder" ON "preorder_tiers" ("preorderId")`);

        // Demos table indexes
        await queryRunner.query(`CREATE INDEX "IDX_demos_game" ON "demos" ("gameId")`);
        await queryRunner.query(`CREATE INDEX "IDX_demos_type" ON "demos" ("type")`);
        await queryRunner.query(`CREATE INDEX "IDX_demos_is_available" ON "demos" ("isAvailable")`);

        // Game editions table indexes
        await queryRunner.query(`CREATE INDEX "IDX_game_editions_game" ON "game_editions" ("gameId")`);

        // DLCs table indexes
        await queryRunner.query(`CREATE INDEX "IDX_dlcs_base_game" ON "dlcs" ("baseGameId")`);
        await queryRunner.query(`CREATE INDEX "IDX_dlcs_release_date" ON "dlcs" ("releaseDate")`);

        // Screenshots table indexes
        await queryRunner.query(`CREATE INDEX "IDX_game_screenshots_game" ON "game_screenshots" ("gameId")`);
        await queryRunner.query(`CREATE INDEX "IDX_game_screenshots_sort_order" ON "game_screenshots" ("sortOrder")`);

        // Videos table indexes
        await queryRunner.query(`CREATE INDEX "IDX_game_videos_game" ON "game_videos" ("gameId")`);
        await queryRunner.query(`CREATE INDEX "IDX_game_videos_type" ON "game_videos" ("videoType")`);
        await queryRunner.query(`CREATE INDEX "IDX_game_videos_sort_order" ON "game_videos" ("sortOrder")`);

        // Discounts table indexes
        await queryRunner.query(`CREATE INDEX "IDX_game_discounts_game" ON "game_discounts" ("gameId")`);
        await queryRunner.query(`CREATE INDEX "IDX_game_discounts_is_active" ON "game_discounts" ("isActive")`);
        await queryRunner.query(`CREATE INDEX "IDX_game_discounts_start_date" ON "game_discounts" ("startDate")`);
        await queryRunner.query(`CREATE INDEX "IDX_game_discounts_end_date" ON "game_discounts" ("endDate")`);

        // Translations table indexes
        await queryRunner.query(`CREATE INDEX "IDX_game_translations_game" ON "game_translations" ("gameId")`);
        await queryRunner.query(`CREATE INDEX "IDX_game_translations_language" ON "game_translations" ("languageCode")`);

        // Junction table indexes
        await queryRunner.query(`CREATE INDEX "IDX_game_categories_game" ON "game_categories" ("game_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_game_categories_category" ON "game_categories" ("category_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_game_tags_game" ON "game_tags" ("game_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_game_tags_tag" ON "game_tags" ("tag_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_bundle_games_bundle" ON "bundle_games" ("bundle_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_bundle_games_game" ON "bundle_games" ("game_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_franchise_games_franchise" ON "franchise_games" ("franchise_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_franchise_games_game" ON "franchise_games" ("game_id")`);

        // Create full-text search indexes and triggers

        // Function to update search vector for games
        await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_games_search_vector() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector := 
          setweight(to_tsvector('russian_unaccent', COALESCE(NEW.title, '')), 'A') ||
          setweight(to_tsvector('russian_unaccent', COALESCE(NEW.description, '')), 'B') ||
          setweight(to_tsvector('russian_unaccent', COALESCE(NEW."shortDescription", '')), 'C');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

        // Trigger to automatically update search vector
        await queryRunner.query(`
      CREATE TRIGGER games_search_vector_update 
      BEFORE INSERT OR UPDATE ON games 
      FOR EACH ROW EXECUTE FUNCTION update_games_search_vector();
    `);

        // Create GIN index for full-text search
        await queryRunner.query(`CREATE INDEX "IDX_games_search_vector" ON "games" USING GIN ("search_vector")`);

        // Update existing games search vectors
        await queryRunner.query(`UPDATE "games" SET "updatedAt" = "updatedAt"`);

        // Create composite indexes for common queries
        await queryRunner.query(`CREATE INDEX "IDX_games_status_release_date" ON "games" ("status", "releaseDate")`);
        await queryRunner.query(`CREATE INDEX "IDX_games_status_price" ON "games" ("status", "price")`);
        await queryRunner.query(`CREATE INDEX "IDX_games_is_free_status" ON "games" ("isFree", "status")`);
        await queryRunner.query(`CREATE INDEX "IDX_game_discounts_active_dates" ON "game_discounts" ("isActive", "startDate", "endDate")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop composite indexes
        await queryRunner.query(`DROP INDEX "IDX_game_discounts_active_dates"`);
        await queryRunner.query(`DROP INDEX "IDX_games_is_free_status"`);
        await queryRunner.query(`DROP INDEX "IDX_games_status_price"`);
        await queryRunner.query(`DROP INDEX "IDX_games_status_release_date"`);

        // Drop full-text search components
        await queryRunner.query(`DROP INDEX "IDX_games_search_vector"`);
        await queryRunner.query(`DROP TRIGGER games_search_vector_update ON games`);
        await queryRunner.query(`DROP FUNCTION update_games_search_vector()`);

        // Drop all other indexes
        await queryRunner.query(`DROP INDEX "IDX_franchise_games_game"`);
        await queryRunner.query(`DROP INDEX "IDX_franchise_games_franchise"`);
        await queryRunner.query(`DROP INDEX "IDX_bundle_games_game"`);
        await queryRunner.query(`DROP INDEX "IDX_bundle_games_bundle"`);
        await queryRunner.query(`DROP INDEX "IDX_game_tags_tag"`);
        await queryRunner.query(`DROP INDEX "IDX_game_tags_game"`);
        await queryRunner.query(`DROP INDEX "IDX_game_categories_category"`);
        await queryRunner.query(`DROP INDEX "IDX_game_categories_game"`);
        await queryRunner.query(`DROP INDEX "IDX_game_translations_language"`);
        await queryRunner.query(`DROP INDEX "IDX_game_translations_game"`);
        await queryRunner.query(`DROP INDEX "IDX_game_discounts_end_date"`);
        await queryRunner.query(`DROP INDEX "IDX_game_discounts_start_date"`);
        await queryRunner.query(`DROP INDEX "IDX_game_discounts_is_active"`);
        await queryRunner.query(`DROP INDEX "IDX_game_discounts_game"`);
        await queryRunner.query(`DROP INDEX "IDX_game_videos_sort_order"`);
        await queryRunner.query(`DROP INDEX "IDX_game_videos_type"`);
        await queryRunner.query(`DROP INDEX "IDX_game_videos_game"`);
        await queryRunner.query(`DROP INDEX "IDX_game_screenshots_sort_order"`);
        await queryRunner.query(`DROP INDEX "IDX_game_screenshots_game"`);
        await queryRunner.query(`DROP INDEX "IDX_dlcs_release_date"`);
        await queryRunner.query(`DROP INDEX "IDX_dlcs_base_game"`);
        await queryRunner.query(`DROP INDEX "IDX_game_editions_game"`);
        await queryRunner.query(`DROP INDEX "IDX_demos_is_available"`);
        await queryRunner.query(`DROP INDEX "IDX_demos_type"`);
        await queryRunner.query(`DROP INDEX "IDX_demos_game"`);
        await queryRunner.query(`DROP INDEX "IDX_preorder_tiers_preorder"`);
        await queryRunner.query(`DROP INDEX "IDX_preorders_is_available"`);
        await queryRunner.query(`DROP INDEX "IDX_preorders_release_date"`);
        await queryRunner.query(`DROP INDEX "IDX_preorders_start_date"`);
        await queryRunner.query(`DROP INDEX "IDX_preorders_game"`);
        await queryRunner.query(`DROP INDEX "IDX_tags_slug"`);
        await queryRunner.query(`DROP INDEX "IDX_tags_name"`);
        await queryRunner.query(`DROP INDEX "IDX_categories_parent"`);
        await queryRunner.query(`DROP INDEX "IDX_categories_slug"`);
        await queryRunner.query(`DROP INDEX "IDX_categories_name"`);
        await queryRunner.query(`DROP INDEX "IDX_games_created_at"`);
        await queryRunner.query(`DROP INDEX "IDX_games_is_free"`);
        await queryRunner.query(`DROP INDEX "IDX_games_price"`);
        await queryRunner.query(`DROP INDEX "IDX_games_release_date"`);
        await queryRunner.query(`DROP INDEX "IDX_games_publisher"`);
        await queryRunner.query(`DROP INDEX "IDX_games_developer"`);
        await queryRunner.query(`DROP INDEX "IDX_games_status"`);
        await queryRunner.query(`DROP INDEX "IDX_games_slug"`);
        await queryRunner.query(`DROP INDEX "IDX_games_title"`);

        // Drop foreign key constraints
        await queryRunner.query(`ALTER TABLE "franchise_games" DROP CONSTRAINT "FK_franchise_games_game"`);
        await queryRunner.query(`ALTER TABLE "franchise_games" DROP CONSTRAINT "FK_franchise_games_franchise"`);
        await queryRunner.query(`ALTER TABLE "bundle_games" DROP CONSTRAINT "FK_bundle_games_game"`);
        await queryRunner.query(`ALTER TABLE "bundle_games" DROP CONSTRAINT "FK_bundle_games_bundle"`);
        await queryRunner.query(`ALTER TABLE "game_tags" DROP CONSTRAINT "FK_game_tags_tag"`);
        await queryRunner.query(`ALTER TABLE "game_tags" DROP CONSTRAINT "FK_game_tags_game"`);
        await queryRunner.query(`ALTER TABLE "game_categories" DROP CONSTRAINT "FK_game_categories_category"`);
        await queryRunner.query(`ALTER TABLE "game_categories" DROP CONSTRAINT "FK_game_categories_game"`);
        await queryRunner.query(`ALTER TABLE "game_translations" DROP CONSTRAINT "FK_game_translations_game"`);
        await queryRunner.query(`ALTER TABLE "game_discounts" DROP CONSTRAINT "FK_game_discounts_game"`);
        await queryRunner.query(`ALTER TABLE "game_videos" DROP CONSTRAINT "FK_game_videos_game"`);
        await queryRunner.query(`ALTER TABLE "game_screenshots" DROP CONSTRAINT "FK_game_screenshots_game"`);
        await queryRunner.query(`ALTER TABLE "dlcs" DROP CONSTRAINT "FK_dlcs_base_game"`);
        await queryRunner.query(`ALTER TABLE "game_editions" DROP CONSTRAINT "FK_game_editions_game"`);
        await queryRunner.query(`ALTER TABLE "demos" DROP CONSTRAINT "FK_demos_game"`);
        await queryRunner.query(`ALTER TABLE "preorder_tiers" DROP CONSTRAINT "FK_preorder_tiers_preorder"`);
        await queryRunner.query(`ALTER TABLE "preorders" DROP CONSTRAINT "FK_preorders_game"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_categories_parent"`);
    }
}