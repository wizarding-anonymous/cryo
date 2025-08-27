import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuditLogTable1724589004427 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "audit_log" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" UUID REFERENCES "users"("id"),
                "action" VARCHAR(100) NOT NULL,
                "resource_type" VARCHAR(50),
                "resource_id" VARCHAR(255),
                "details" JSONB,
                "ip_address" INET,
                "user_agent" TEXT,
                "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE INDEX "idx_audit_log_user_created" ON "audit_log"("user_id", "created_at");
            CREATE INDEX "idx_audit_log_action_created" ON "audit_log"("action", "created_at");
            CREATE INDEX "idx_audit_log_resource" ON "audit_log"("resource_type", "resource_id");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE "audit_log";
        `);
    }

}
