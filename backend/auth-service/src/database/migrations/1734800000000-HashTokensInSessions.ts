import { MigrationInterface, QueryRunner } from 'typeorm';
import { createHash } from 'crypto';

export class HashTokensInSessions1734800000000 implements MigrationInterface {
  name = 'HashTokensInSessions1734800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Add new columns for hashed tokens
    await queryRunner.query(`
      ALTER TABLE "sessions" 
      ADD COLUMN "accessTokenHash" text,
      ADD COLUMN "refreshTokenHash" text
    `);

    // Step 2: Hash existing tokens and populate new columns
    const sessions = await queryRunner.query(`
      SELECT id, "accessToken", "refreshToken" 
      FROM "sessions" 
      WHERE "accessToken" IS NOT NULL AND "refreshToken" IS NOT NULL
    `);

    for (const session of sessions) {
      const accessTokenHash = createHash('sha256').update(session.accessToken).digest('hex');
      const refreshTokenHash = createHash('sha256').update(session.refreshToken).digest('hex');
      
      await queryRunner.query(`
        UPDATE "sessions" 
        SET "accessTokenHash" = $1, "refreshTokenHash" = $2 
        WHERE id = $3
      `, [accessTokenHash, refreshTokenHash, session.id]);
    }

    // Step 3: Make new columns NOT NULL after populating them
    await queryRunner.query(`
      ALTER TABLE "sessions" 
      ALTER COLUMN "accessTokenHash" SET NOT NULL,
      ALTER COLUMN "refreshTokenHash" SET NOT NULL
    `);

    // Step 4: Create indexes on new hash columns
    await queryRunner.query(`
      CREATE INDEX "IDX_sessions_accessTokenHash" ON "sessions" ("accessTokenHash")
    `);
    
    await queryRunner.query(`
      CREATE INDEX "IDX_sessions_refreshTokenHash" ON "sessions" ("refreshTokenHash")
    `);

    // Step 5: Drop indexes on old token columns
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sessions_accessToken"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sessions_refreshToken"`);

    // Step 6: Drop old token columns (CRITICAL SECURITY STEP)
    await queryRunner.query(`
      ALTER TABLE "sessions" 
      DROP COLUMN "accessToken",
      DROP COLUMN "refreshToken"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // WARNING: This rollback will lose token data since we can't unhash tokens
    // This is intentional for security - once tokens are hashed, they cannot be recovered
    
    // Step 1: Add back old token columns
    await queryRunner.query(`
      ALTER TABLE "sessions" 
      ADD COLUMN "accessToken" text,
      ADD COLUMN "refreshToken" text
    `);

    // Step 2: Create indexes on old token columns
    await queryRunner.query(`
      CREATE INDEX "IDX_sessions_accessToken" ON "sessions" ("accessToken")
    `);
    
    await queryRunner.query(`
      CREATE INDEX "IDX_sessions_refreshToken" ON "sessions" ("refreshToken")
    `);

    // Step 3: Drop indexes on hash columns
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sessions_accessTokenHash"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sessions_refreshTokenHash"`);

    // Step 4: Drop hash columns
    await queryRunner.query(`
      ALTER TABLE "sessions" 
      DROP COLUMN "accessTokenHash",
      DROP COLUMN "refreshTokenHash"
    `);

    // Note: All existing sessions will be invalid after rollback
    // Users will need to log in again to get new tokens
  }
}