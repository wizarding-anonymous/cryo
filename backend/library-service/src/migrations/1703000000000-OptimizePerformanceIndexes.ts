import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptimizePerformanceIndexes1703000000000 implements MigrationInterface {
  name = 'OptimizePerformanceIndexes1703000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create composite indexes for better query performance
    
    // Library Games Performance Indexes
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_library_games_user_purchase_date" 
      ON "library_games" ("userId", "purchaseDate" DESC);
    `);
    
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_library_games_user_price" 
      ON "library_games" ("userId", "purchasePrice");
    `);
    
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_library_games_user_currency_date" 
      ON "library_games" ("userId", "currency", "purchaseDate" DESC);
    `);
    
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_library_games_game_purchase_date" 
      ON "library_games" ("gameId", "purchaseDate" DESC);
    `);
    
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_library_games_order_purchase" 
      ON "library_games" ("orderId", "purchaseId");
    `);
    
    // Purchase History Performance Indexes
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_purchase_history_user_created_at" 
      ON "purchase_history" ("userId", "createdAt" DESC);
    `);
    
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_purchase_history_user_status_date" 
      ON "purchase_history" ("userId", "status", "createdAt" DESC);
    `);
    
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_purchase_history_user_amount" 
      ON "purchase_history" ("userId", "amount");
    `);
    
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_purchase_history_user_currency_date" 
      ON "purchase_history" ("userId", "currency", "createdAt" DESC);
    `);
    
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_purchase_history_game_user_date" 
      ON "purchase_history" ("gameId", "userId", "createdAt" DESC);
    `);
    
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_purchase_history_payment_method" 
      ON "purchase_history" ("paymentMethod", "createdAt" DESC);
    `);
    
    // Partial indexes for common queries
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_purchase_history_completed_status" 
      ON "purchase_history" ("userId", "createdAt" DESC) 
      WHERE "status" = 'completed';
    `);
    
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_purchase_history_recent_purchases" 
      ON "purchase_history" ("userId", "gameId", "createdAt" DESC) 
      WHERE "createdAt" >= NOW() - INTERVAL '30 days';
    `);
    
    // GIN indexes for JSONB metadata search
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_purchase_history_metadata_gin" 
      ON "purchase_history" USING GIN ("metadata");
    `);
    
    // Covering indexes for common SELECT queries
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_library_games_covering_basic" 
      ON "library_games" ("userId", "purchaseDate" DESC) 
      INCLUDE ("gameId", "purchasePrice", "currency", "orderId");
    `);
    
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_purchase_history_covering_basic" 
      ON "purchase_history" ("userId", "createdAt" DESC) 
      INCLUDE ("gameId", "amount", "currency", "status", "paymentMethod");
    `);
    
    // Indexes for JOIN operations between tables
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_library_games_join_history" 
      ON "library_games" ("userId", "gameId", "orderId");
    `);
    
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_purchase_history_join_library" 
      ON "purchase_history" ("userId", "gameId", "orderId");
    `);
    
    // Statistics update for better query planning
    await queryRunner.query(`ANALYZE "library_games";`);
    await queryRunner.query(`ANALYZE "purchase_history";`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all performance indexes
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_library_games_user_purchase_date";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_library_games_user_price";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_library_games_user_currency_date";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_library_games_game_purchase_date";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_library_games_order_purchase";`);
    
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_purchase_history_user_created_at";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_purchase_history_user_status_date";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_purchase_history_user_amount";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_purchase_history_user_currency_date";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_purchase_history_game_user_date";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_purchase_history_payment_method";`);
    
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_purchase_history_completed_status";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_purchase_history_recent_purchases";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_purchase_history_metadata_gin";`);
    
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_library_games_covering_basic";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_purchase_history_covering_basic";`);
    
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_library_games_join_history";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_purchase_history_join_library";`);
  }
}