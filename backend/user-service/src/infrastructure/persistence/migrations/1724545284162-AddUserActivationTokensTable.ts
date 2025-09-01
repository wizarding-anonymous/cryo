import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserActivationTokensTable1724545284162 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "user_activation_tokens" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
                "token" VARCHAR(255) UNIQUE NOT NULL,
                "expires_at" TIMESTAMP NOT NULL,
                "used_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE INDEX "idx_user_activation_tokens_token" ON "user_activation_tokens"("token");
            CREATE INDEX "idx_user_activation_tokens_user_id" ON "user_activation_tokens"("user_id");
            CREATE INDEX "idx_user_activation_tokens_expires_at" ON "user_activation_tokens"("expires_at");
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP TABLE "user_activation_tokens";
        `);
  }
}
