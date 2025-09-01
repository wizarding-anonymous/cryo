import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCustomizationPreferencesToUsers1703000001000 implements MigrationInterface {
  name = 'AddCustomizationPreferencesToUsers1703000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'customization_preferences',
        type: 'jsonb',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'customization_preferences');
  }
}
