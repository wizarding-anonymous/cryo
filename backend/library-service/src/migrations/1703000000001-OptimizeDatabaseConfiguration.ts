import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptimizeDatabaseConfiguration1703000000001 implements MigrationInterface {
  name = 'OptimizeDatabaseConfiguration1703000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create materialized views for expensive aggregations
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_user_library_stats" AS
      SELECT 
        "userId",
        COUNT(*) as "totalGames",
        SUM("purchasePrice") as "totalSpent",
        AVG("purchasePrice") as "averagePrice",
        MIN("purchaseDate") as "oldestPurchase",
        MAX("purchaseDate") as "newestPurchase",
        array_agg(DISTINCT "currency") as "currencies",
        COUNT(DISTINCT "currency") as "currencyCount"
      FROM "library_games"
      GROUP BY "userId";
    `);
    
    await queryRunner.query(`
      CREATE UNIQUE INDEX ON "mv_user_library_stats" ("userId");
    `);
    
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_user_purchase_stats" AS
      SELECT 
        "userId",
        COUNT(*) as "totalPurchases",
        SUM("amount") as "totalSpent",
        AVG("amount") as "averageAmount",
        COUNT(CASE WHEN "status" = 'completed' THEN 1 END) as "completedPurchases",
        COUNT(CASE WHEN "status" = 'refunded' THEN 1 END) as "refundedPurchases",
        COUNT(CASE WHEN "status" = 'cancelled' THEN 1 END) as "cancelledPurchases",
        array_agg(DISTINCT "paymentMethod") as "paymentMethods",
        array_agg(DISTINCT "currency") as "currencies"
      FROM "purchase_history"
      GROUP BY "userId";
    `);
    
    await queryRunner.query(`
      CREATE UNIQUE INDEX ON "mv_user_purchase_stats" ("userId");
    `);
    
    // Create function for refreshing materialized views
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION refresh_user_stats_views()
      RETURNS void AS $$
      BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_user_library_stats";
        REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_user_purchase_stats";
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Create partitioned tables for large datasets (future-proofing)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "library_games_archive" (
        LIKE "library_games" INCLUDING ALL
      ) PARTITION BY RANGE ("purchaseDate");
    `);
    
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "purchase_history_archive" (
        LIKE "purchase_history" INCLUDING ALL
      ) PARTITION BY RANGE ("createdAt");
    `);
    
    // Create stored procedures for common operations
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION get_user_library_page(
        p_user_id UUID,
        p_page INTEGER DEFAULT 1,
        p_limit INTEGER DEFAULT 20,
        p_sort_by TEXT DEFAULT 'purchaseDate',
        p_sort_order TEXT DEFAULT 'DESC'
      )
      RETURNS TABLE(
        id UUID,
        "userId" UUID,
        "gameId" UUID,
        "purchaseDate" TIMESTAMP,
        "purchasePrice" DECIMAL,
        currency VARCHAR,
        "orderId" UUID,
        "purchaseId" UUID,
        "createdAt" TIMESTAMP,
        "updatedAt" TIMESTAMP,
        total_count BIGINT
      ) AS $$
      DECLARE
        offset_val INTEGER;
        sort_column TEXT;
        order_direction TEXT;
      BEGIN
        offset_val := (p_page - 1) * p_limit;
        
        -- Validate sort column
        sort_column := CASE 
          WHEN p_sort_by IN ('purchaseDate', 'purchasePrice', 'createdAt') THEN p_sort_by
          ELSE 'purchaseDate'
        END;
        
        -- Validate sort order
        order_direction := CASE 
          WHEN UPPER(p_sort_order) IN ('ASC', 'DESC') THEN UPPER(p_sort_order)
          ELSE 'DESC'
        END;
        
        RETURN QUERY EXECUTE format('
          SELECT lg.*, COUNT(*) OVER() as total_count
          FROM library_games lg
          WHERE lg."userId" = $1
          ORDER BY lg."%s" %s
          LIMIT $2 OFFSET $3
        ', sort_column, order_direction)
        USING p_user_id, p_limit, offset_val;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION search_user_library(
        p_user_id UUID,
        p_search_query TEXT,
        p_page INTEGER DEFAULT 1,
        p_limit INTEGER DEFAULT 20
      )
      RETURNS TABLE(
        id UUID,
        "userId" UUID,
        "gameId" UUID,
        "purchaseDate" TIMESTAMP,
        "purchasePrice" DECIMAL,
        currency VARCHAR,
        "orderId" UUID,
        "purchaseId" UUID,
        "createdAt" TIMESTAMP,
        "updatedAt" TIMESTAMP,
        total_count BIGINT,
        search_rank REAL
      ) AS $$
      DECLARE
        offset_val INTEGER;
      BEGIN
        offset_val := (p_page - 1) * p_limit;
        
        RETURN QUERY
        SELECT 
          lg.*,
          COUNT(*) OVER() as total_count,
          ts_rank(
            to_tsvector('english', 
              COALESCE(lg."gameId"::text, '') || ' ' ||
              COALESCE(lg."orderId"::text, '') || ' ' ||
              COALESCE(lg.currency, '')
            ),
            plainto_tsquery('english', p_search_query)
          ) as search_rank
        FROM library_games lg
        WHERE lg."userId" = p_user_id
          AND (
            lg."gameId"::text ILIKE '%' || p_search_query || '%' OR
            lg."orderId"::text ILIKE '%' || p_search_query || '%' OR
            lg.currency ILIKE '%' || p_search_query || '%' OR
            to_tsvector('english', 
              COALESCE(lg."gameId"::text, '') || ' ' ||
              COALESCE(lg."orderId"::text, '') || ' ' ||
              COALESCE(lg.currency, '')
            ) @@ plainto_tsquery('english', p_search_query)
          )
        ORDER BY search_rank DESC, lg."purchaseDate" DESC
        LIMIT p_limit OFFSET offset_val;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Create function for bulk operations
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION bulk_add_library_games(
        games JSONB
      )
      RETURNS INTEGER AS $$
      DECLARE
        inserted_count INTEGER;
      BEGIN
        WITH game_data AS (
          SELECT 
            (value->>'userId')::UUID as "userId",
            (value->>'gameId')::UUID as "gameId",
            (value->>'purchaseDate')::TIMESTAMP as "purchaseDate",
            (value->>'purchasePrice')::DECIMAL as "purchasePrice",
            value->>'currency' as currency,
            (value->>'orderId')::UUID as "orderId",
            (value->>'purchaseId')::UUID as "purchaseId"
          FROM jsonb_array_elements(games)
        )
        INSERT INTO library_games ("userId", "gameId", "purchaseDate", "purchasePrice", currency, "orderId", "purchaseId")
        SELECT "userId", "gameId", "purchaseDate", "purchasePrice", currency, "orderId", "purchaseId"
        FROM game_data
        ON CONFLICT ("userId", "gameId") DO UPDATE SET
          "purchasePrice" = EXCLUDED."purchasePrice",
          "purchaseDate" = EXCLUDED."purchaseDate",
          "orderId" = EXCLUDED."orderId",
          "purchaseId" = EXCLUDED."purchaseId",
          "updatedAt" = NOW();
        
        GET DIAGNOSTICS inserted_count = ROW_COUNT;
        RETURN inserted_count;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Create triggers for automatic stats refresh
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION trigger_refresh_user_stats()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Schedule a background refresh of materialized views
        -- In production, this would be handled by a job scheduler
        PERFORM pg_notify('refresh_stats', NEW."userId"::text);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await queryRunner.query(`
      CREATE TRIGGER library_games_stats_refresh
        AFTER INSERT OR UPDATE OR DELETE ON library_games
        FOR EACH ROW EXECUTE FUNCTION trigger_refresh_user_stats();
    `);
    
    await queryRunner.query(`
      CREATE TRIGGER purchase_history_stats_refresh
        AFTER INSERT OR UPDATE OR DELETE ON purchase_history
        FOR EACH ROW EXECUTE FUNCTION trigger_refresh_user_stats();
    `);
    
    // Create indexes on materialized views
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mv_user_library_stats_total_games" 
      ON "mv_user_library_stats" ("totalGames" DESC);
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mv_user_library_stats_total_spent" 
      ON "mv_user_library_stats" ("totalSpent" DESC);
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mv_user_purchase_stats_total_purchases" 
      ON "mv_user_purchase_stats" ("totalPurchases" DESC);
    `);
    
    // Update table statistics
    await queryRunner.query(`ANALYZE "library_games";`);
    await queryRunner.query(`ANALYZE "purchase_history";`);
    await queryRunner.query(`ANALYZE "mv_user_library_stats";`);
    await queryRunner.query(`ANALYZE "mv_user_purchase_stats";`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS library_games_stats_refresh ON library_games;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS purchase_history_stats_refresh ON purchase_history;`);
    
    // Drop functions
    await queryRunner.query(`DROP FUNCTION IF EXISTS trigger_refresh_user_stats();`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS bulk_add_library_games(JSONB);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS search_user_library(UUID, TEXT, INTEGER, INTEGER);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS get_user_library_page(UUID, INTEGER, INTEGER, TEXT, TEXT);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS refresh_user_stats_views();`);
    
    // Drop materialized views
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS "mv_user_purchase_stats";`);
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS "mv_user_library_stats";`);
    
    // Drop partitioned tables
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_history_archive";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "library_games_archive";`);
  }
}