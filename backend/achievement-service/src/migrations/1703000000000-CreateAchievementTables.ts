import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateAchievementTables1703000000000 implements MigrationInterface {
  name = 'CreateAchievementTables1703000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create achievements table
    await queryRunner.createTable(
      new Table({
        name: 'achievements',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isUnique: true,
          },
          {
            name: 'description',
            type: 'text',
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['first_purchase', 'first_review', 'first_friend', 'games_purchased', 'reviews_written'],
          },
          {
            name: 'condition',
            type: 'jsonb',
          },
          {
            name: 'iconUrl',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'points',
            type: 'int',
            default: 0,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create user_achievements table
    await queryRunner.createTable(
      new Table({
        name: 'user_achievements',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'userId',
            type: 'uuid',
          },
          {
            name: 'achievementId',
            type: 'uuid',
          },
          {
            name: 'unlockedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['achievementId'],
            referencedTableName: 'achievements',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // Create user_progress table
    await queryRunner.createTable(
      new Table({
        name: 'user_progress',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'userId',
            type: 'uuid',
          },
          {
            name: 'achievementId',
            type: 'uuid',
          },
          {
            name: 'currentValue',
            type: 'int',
            default: 0,
          },
          {
            name: 'targetValue',
            type: 'int',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['achievementId'],
            referencedTableName: 'achievements',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // Create indexes for optimization
    await queryRunner.query(`CREATE INDEX "IDX_achievements_name" ON "achievements" ("name")`);
    await queryRunner.query(`CREATE INDEX "IDX_achievements_type" ON "achievements" ("type")`);
    
    await queryRunner.query(`CREATE INDEX "IDX_user_achievements_userId" ON "user_achievements" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_achievements_achievementId" ON "user_achievements" ("achievementId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_user_achievements_userId_achievementId" ON "user_achievements" ("userId", "achievementId")`);
    
    await queryRunner.query(`CREATE INDEX "IDX_user_progress_userId" ON "user_progress" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_progress_achievementId" ON "user_progress" ("achievementId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_user_progress_userId_achievementId" ON "user_progress" ("userId", "achievementId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_user_progress_userId_achievementId"`);
    await queryRunner.query(`DROP INDEX "IDX_user_progress_achievementId"`);
    await queryRunner.query(`DROP INDEX "IDX_user_progress_userId"`);
    
    await queryRunner.query(`DROP INDEX "IDX_user_achievements_userId_achievementId"`);
    await queryRunner.query(`DROP INDEX "IDX_user_achievements_achievementId"`);
    await queryRunner.query(`DROP INDEX "IDX_user_achievements_userId"`);
    
    await queryRunner.query(`DROP INDEX "IDX_achievements_type"`);
    await queryRunner.query(`DROP INDEX "IDX_achievements_name"`);

    // Drop tables
    await queryRunner.dropTable('user_progress');
    await queryRunner.dropTable('user_achievements');
    await queryRunner.dropTable('achievements');
  }
}