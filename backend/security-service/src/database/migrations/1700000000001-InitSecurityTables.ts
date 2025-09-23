import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSecurityTables1700000000001 implements MigrationInterface {
  name = 'InitSecurityTables1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // security_events
    await queryRunner.query(`
      CREATE TABLE "security_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "public"."security_events_type_enum" NOT NULL DEFAULT 'OTHER',
        "user_id" uuid,
        "ip" character varying(45),
        "user_agent" character varying(512),
        "data" jsonb,
        "risk_score" double precision,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_security_events_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_security_event_type" ON "security_events" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_security_event_user" ON "security_events" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_security_event_ip" ON "security_events" ("ip")`);
    await queryRunner.query(`CREATE INDEX "IDX_security_event_created_at" ON "security_events" ("created_at")`);

    // security_alerts
    await queryRunner.query(`
      CREATE TABLE "security_alerts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "public"."security_alerts_type_enum" NOT NULL DEFAULT 'SUSPICIOUS_ACTIVITY',
        "severity" "public"."security_alerts_severity_enum" NOT NULL DEFAULT 'LOW',
        "user_id" uuid,
        "ip" character varying(45),
        "data" jsonb,
        "resolved" boolean NOT NULL DEFAULT false,
        "resolved_by" uuid,
        "resolved_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_security_alerts_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_security_alert_resolved" ON "security_alerts" ("resolved")`);

    // ip_blocks
    await queryRunner.query(`
      CREATE TABLE "ip_blocks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ip" character varying(45) NOT NULL,
        "reason" character varying(512),
        "blocked_until" TIMESTAMP WITH TIME ZONE,
        "blocked_by" uuid,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ip_blocks_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_ip_block_ip" ON "ip_blocks" ("ip")`);
    await queryRunner.query(`CREATE INDEX "IDX_ip_block_active" ON "ip_blocks" ("is_active")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_ip_block_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_ip_block_ip"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ip_blocks"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_security_alert_resolved"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "security_alerts"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_security_event_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_security_event_ip"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_security_event_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_security_event_type"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "security_events"`);
  }
}

