import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateUserSessionsTable1703000000000 implements MigrationInterface {
  name = 'CreateUserSessionsTable1703000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_sessions',
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
            isNullable: false,
          },
          {
            name: 'deviceInfo',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'ipAddress',
            type: 'varchar',
            length: '45',
            isNullable: false,
          },
          {
            name: 'userAgent',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'accessTokenHash',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'refreshTokenHash',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'expiresAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'terminatedReason',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'terminatedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'lastActivityAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Создаем индексы для оптимизации
    await queryRunner.createIndex(
      'user_sessions',
      new TableIndex({
        name: 'IDX_user_sessions_userId',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'user_sessions',
      new TableIndex({
        name: 'IDX_user_sessions_isActive',
        columnNames: ['isActive'],
      }),
    );

    await queryRunner.createIndex(
      'user_sessions',
      new TableIndex({
        name: 'IDX_user_sessions_expiresAt',
        columnNames: ['expiresAt'],
      }),
    );

    await queryRunner.createIndex(
      'user_sessions',
      new TableIndex({
        name: 'IDX_user_sessions_userId_isActive',
        columnNames: ['userId', 'isActive'],
      }),
    );

    // Создаем внешний ключ к таблице users
    await queryRunner.query(`
      ALTER TABLE user_sessions 
      ADD CONSTRAINT FK_user_sessions_userId 
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('user_sessions', 'FK_user_sessions_userId');
    await queryRunner.dropIndex('user_sessions', 'IDX_user_sessions_userId_isActive');
    await queryRunner.dropIndex('user_sessions', 'IDX_user_sessions_expiresAt');
    await queryRunner.dropIndex('user_sessions', 'IDX_user_sessions_isActive');
    await queryRunner.dropIndex('user_sessions', 'IDX_user_sessions_userId');
    await queryRunner.dropTable('user_sessions');
  }
}
