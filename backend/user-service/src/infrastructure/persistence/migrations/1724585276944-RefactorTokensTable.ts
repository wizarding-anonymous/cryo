import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorTokensTable1724585276944 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename the table
    await queryRunner.query(`ALTER TABLE "user_activation_tokens" RENAME TO "user_tokens"`);

    // Add the new column
    await queryRunner.query(
      `ALTER TABLE "user_tokens" ADD COLUMN "token_type" VARCHAR(50) NOT NULL DEFAULT 'activation'`,
    );

    // Add new indexes
    await queryRunner.query(`CREATE INDEX "idx_user_tokens_token_type" ON "user_tokens"("token_type")`);
    await queryRunner.query(
      `CREATE INDEX "idx_user_tokens_user_id_token_type" ON "user_tokens"("user_id", "token_type")`,
    );

    // Rename old indexes if necessary (optional but good practice)
    await queryRunner.query(`ALTER INDEX "idx_user_activation_tokens_token" RENAME TO "idx_user_tokens_token"`);
    await queryRunner.query(`ALTER INDEX "idx_user_activation_tokens_user_id" RENAME TO "idx_user_tokens_user_id"`);
    await queryRunner.query(
      `ALTER INDEX "idx_user_activation_tokens_expires_at" RENAME TO "idx_user_tokens_expires_at"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop new indexes
    await queryRunner.query(`DROP INDEX "idx_user_tokens_user_id_token_type"`);
    await queryRunner.query(`DROP INDEX "idx_user_tokens_token_type"`);

    // Drop the column
    await queryRunner.query(`ALTER TABLE "user_tokens" DROP COLUMN "token_type"`);

    // Rename the table back
    await queryRunner.query(`ALTER TABLE "user_tokens" RENAME TO "user_activation_tokens"`);

    // Rename indexes back
    await queryRunner.query(`ALTER INDEX "idx_user_tokens_token" RENAME TO "idx_user_activation_tokens_token"`);
    await queryRunner.query(`ALTER INDEX "idx_user_tokens_user_id" RENAME TO "idx_user_activation_tokens_user_id"`);
    await queryRunner.query(
      `ALTER INDEX "idx_user_tokens_expires_at" RENAME TO "idx_user_activation_tokens_expires_at"`,
    );
  }
}
