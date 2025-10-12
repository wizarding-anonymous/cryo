import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLogoutRollbackSecurityEventType1703000000000 implements MigrationInterface {
  name = 'AddLogoutRollbackSecurityEventType1703000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 'logout_rollback' to the security event type enum
    await queryRunner.query(`
      ALTER TYPE "security_events_type_enum" 
      ADD VALUE IF NOT EXISTS 'logout_rollback'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing enum values directly
    // This would require recreating the enum type and updating all references
    // For safety, we'll leave the enum value in place during rollback
    console.log('Warning: Cannot remove enum value "logout_rollback" from PostgreSQL enum type. Manual intervention required if rollback is necessary.');
  }
}