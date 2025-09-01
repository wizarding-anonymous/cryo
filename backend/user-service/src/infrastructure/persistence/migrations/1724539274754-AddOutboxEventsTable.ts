import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOutboxEventsTable1724539274754 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "outbox_events" (
                "id" UUID PRIMARY KEY,
                "event_type" VARCHAR(100) NOT NULL,
                "payload" JSONB NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
                "retry_count" INTEGER DEFAULT 0,
                "next_retry_at" TIMESTAMP,
                "status" VARCHAR(20) DEFAULT 'pending'
            );
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP TABLE "outbox_events";
        `);
  }
}
