import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptimizeIndexes1673000000001 implements MigrationInterface {
  name = 'OptimizeIndexes1673000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add composite indexes for better query performance
    await queryRunner.query(`
      CREATE INDEX "IDX_library_games_userId_purchaseDate" 
      ON "library_games" ("userId", "purchaseDate" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_library_games_userId_createdAt" 
      ON "library_games" ("userId", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_purchase_history_userId_createdAt" 
      ON "purchase_history" ("userId", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_purchase_history_status" 
      ON "purchase_history" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_purchase_history_userId_status" 
      ON "purchase_history" ("userId", "status")
    `);

    // Add check constraints for data integrity
    await queryRunner.query(`
      ALTER TABLE "library_games" 
      ADD CONSTRAINT "CHK_library_games_purchasePrice" 
      CHECK ("purchasePrice" >= 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "library_games" 
      ADD CONSTRAINT "CHK_library_games_currency" 
      CHECK (LENGTH("currency") = 3)
    `);

    await queryRunner.query(`
      ALTER TABLE "purchase_history" 
      ADD CONSTRAINT "CHK_purchase_history_amount" 
      CHECK ("amount" >= 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "purchase_history" 
      ADD CONSTRAINT "CHK_purchase_history_currency" 
      CHECK (LENGTH("currency") = 3)
    `);

    await queryRunner.query(`
      ALTER TABLE "purchase_history" 
      ADD CONSTRAINT "CHK_purchase_history_status" 
      CHECK ("status" IN ('completed', 'refunded', 'cancelled'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove check constraints
    await queryRunner.query(`
      ALTER TABLE "purchase_history" 
      DROP CONSTRAINT "CHK_purchase_history_status"
    `);

    await queryRunner.query(`
      ALTER TABLE "purchase_history" 
      DROP CONSTRAINT "CHK_purchase_history_currency"
    `);

    await queryRunner.query(`
      ALTER TABLE "purchase_history" 
      DROP CONSTRAINT "CHK_purchase_history_amount"
    `);

    await queryRunner.query(`
      ALTER TABLE "library_games" 
      DROP CONSTRAINT "CHK_library_games_currency"
    `);

    await queryRunner.query(`
      ALTER TABLE "library_games" 
      DROP CONSTRAINT "CHK_library_games_purchasePrice"
    `);

    // Remove indexes
    await queryRunner.query(`DROP INDEX "IDX_purchase_history_userId_status"`);
    await queryRunner.query(`DROP INDEX "IDX_purchase_history_status"`);
    await queryRunner.query(`DROP INDEX "IDX_purchase_history_userId_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_library_games_userId_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_library_games_userId_purchaseDate"`);
  }
}