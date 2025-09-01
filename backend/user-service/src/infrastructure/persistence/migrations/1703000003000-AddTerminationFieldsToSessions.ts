import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTerminationFieldsToSessions1703000003000 implements MigrationInterface {
  name = 'AddTerminationFieldsToSessions1703000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_sessions" 
      ADD COLUMN "terminated_reason" varchar(50),
      ADD COLUMN "terminated_at" timestamp
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_sessions" 
      DROP COLUMN "terminated_reason",
      DROP COLUMN "terminated_at"
    `);
  }
}
