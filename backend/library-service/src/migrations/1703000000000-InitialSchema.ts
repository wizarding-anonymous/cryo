import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1703000000000 implements MigrationInterface {
  name = 'InitialSchema1703000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create library_games table
    await queryRunner.query(`
      CREATE TABLE "library_games" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "gameId" uuid NOT NULL,
        "purchaseDate" TIMESTAMP NOT NULL,
        "purchasePrice" numeric(10,2) NOT NULL,
        "currency" character varying(3) NOT NULL,
        "orderId" uuid NOT NULL,
        "purchaseId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_library_games_id" PRIMARY KEY ("id")
      )
    `);

    // Create purchase_history table
    await queryRunner.query(`
      CREATE TYPE "purchase_history_status_enum" AS ENUM('completed', 'refunded', 'cancelled')
    `);

    await queryRunner.query(`
      CREATE TABLE "purchase_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "gameId" uuid NOT NULL,
        "orderId" uuid NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "currency" character varying(3) NOT NULL,
        "status" "purchase_history_status_enum" NOT NULL,
        "paymentMethod" character varying(100) NOT NULL,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_purchase_history_id" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for library_games
    await queryRunner.query(`
      CREATE INDEX "IDX_library_games_userId" ON "library_games" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_library_games_gameId" ON "library_games" ("gameId")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_library_games_userId_gameId" ON "library_games" ("userId", "gameId")
    `);

    // Create indexes for purchase_history
    await queryRunner.query(`
      CREATE INDEX "IDX_purchase_history_userId" ON "purchase_history" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_purchase_history_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_library_games_userId_gameId"`);
    await queryRunner.query(`DROP INDEX "IDX_library_games_gameId"`);
    await queryRunner.query(`DROP INDEX "IDX_library_games_userId"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "purchase_history"`);
    await queryRunner.query(`DROP TYPE "purchase_history_status_enum"`);
    await queryRunner.query(`DROP TABLE "library_games"`);
  }
}
