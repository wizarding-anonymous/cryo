import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingIndexes1700000000002 implements MigrationInterface {
  name = 'AddMissingIndexes1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "security_alert_type_idx" ON "security_alerts" ("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "security_alert_severity_idx" ON "security_alerts" ("severity")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "security_alert_user_idx" ON "security_alerts" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "security_alert_created_at_idx" ON "security_alerts" ("created_at")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ip_block_blocked_until_idx" ON "ip_blocks" ("blocked_until")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."ip_block_blocked_until_idx"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."security_alert_created_at_idx"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."security_alert_user_idx"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."security_alert_severity_idx"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."security_alert_type_idx"`);
  }
}

