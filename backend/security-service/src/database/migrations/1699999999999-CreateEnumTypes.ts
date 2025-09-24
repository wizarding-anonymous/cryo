import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEnumTypes1699999999999 implements MigrationInterface {
  name = 'CreateEnumTypes1699999999999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE security_events_type_enum AS ENUM ('LOGIN','TRANSACTION','SUSPICIOUS_ACTIVITY','IP_BLOCK','ACCOUNT_LOCK','PASSWORD_RESET','OTHER');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE security_alerts_type_enum AS ENUM ('SUSPICIOUS_ACTIVITY','MULTIPLE_FAILED_LOGINS','POSSIBLE_FRAUD','IP_BLOCKED','OTHER');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE security_alerts_severity_enum AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No down migration to avoid dropping enum types in shared DB
  }
}
