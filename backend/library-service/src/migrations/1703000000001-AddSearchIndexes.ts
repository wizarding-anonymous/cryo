import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSearchIndexes1703000000001 implements MigrationInterface {
  name = 'AddSearchIndexes1703000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add composite indexes for better search performance
    await queryRunner.query(`
      CREATE INDEX "IDX_library_games_userId_purchaseDate" 
      ON "library_games" ("userId", "purchaseDate" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_library_games_userId_purchasePrice" 
      ON "library_games" ("userId", "purchasePrice")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_library_games_userId_currency" 
      ON "library_games" ("userId", "currency")
    `);

    // Add indexes for purchase history search optimization
    await queryRunner.query(`
      CREATE INDEX "IDX_purchase_history_userId_gameId" 
      ON "purchase_history" ("userId", "gameId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_purchase_history_userId_createdAt" 
      ON "purchase_history" ("userId", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_purchase_history_userId_status" 
      ON "purchase_history" ("userId", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_purchase_history_orderId" 
      ON "purchase_history" ("orderId")
    `);

    // Add GIN indexes for full-text search on text fields
    await queryRunner.query(`
      CREATE INDEX "IDX_library_games_gameId_gin" 
      ON "library_games" USING gin (to_tsvector('english', "gameId"::text))
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_purchase_history_paymentMethod_gin" 
      ON "purchase_history" USING gin (to_tsvector('english', "paymentMethod"))
    `);

    // Add partial indexes for active/completed purchases
    await queryRunner.query(`
      CREATE INDEX "IDX_purchase_history_completed" 
      ON "purchase_history" ("userId", "createdAt" DESC) 
      WHERE "status" = 'completed'
    `);

    // Add covering indexes for common query patterns
    await queryRunner.query(`
      CREATE INDEX "IDX_library_games_covering" 
      ON "library_games" ("userId", "gameId") 
      INCLUDE ("purchaseDate", "purchasePrice", "currency")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all the indexes we created
    await queryRunner.query(`DROP INDEX "IDX_library_games_covering"`);
    await queryRunner.query(`DROP INDEX "IDX_purchase_history_completed"`);
    await queryRunner.query(
      `DROP INDEX "IDX_purchase_history_paymentMethod_gin"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_library_games_gameId_gin"`);
    await queryRunner.query(`DROP INDEX "IDX_purchase_history_orderId"`);
    await queryRunner.query(`DROP INDEX "IDX_purchase_history_userId_status"`);
    await queryRunner.query(
      `DROP INDEX "IDX_purchase_history_userId_createdAt"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_purchase_history_userId_gameId"`);
    await queryRunner.query(`DROP INDEX "IDX_library_games_userId_currency"`);
    await queryRunner.query(
      `DROP INDEX "IDX_library_games_userId_purchasePrice"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_library_games_userId_purchaseDate"`,
    );
  }
}
