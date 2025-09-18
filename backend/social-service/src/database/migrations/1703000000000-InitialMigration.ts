import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class InitialMigration1703000000000 implements MigrationInterface {
    name = 'InitialMigration1703000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create friendships table
        await queryRunner.createTable(
            new Table({
                name: 'friendships',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    {
                        name: 'userId',
                        type: 'uuid',
                        isNullable: false,
                    },
                    {
                        name: 'friendId',
                        type: 'uuid',
                        isNullable: false,
                    },
                    {
                        name: 'status',
                        type: 'enum',
                        enum: ['pending', 'accepted', 'declined', 'blocked'],
                        isNullable: false,
                    },
                    {
                        name: 'requestedBy',
                        type: 'uuid',
                        isNullable: true,
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
                    },
                ],
            }),
            true,
        );

        // Create unique index for userId and friendId combination
        await queryRunner.createIndex(
            'friendships',
            new TableIndex({
                name: 'IDX_FRIENDSHIP_USER_FRIEND',
                columnNames: ['userId', 'friendId'],
                isUnique: true,
            }),
        );

        // Create individual indexes for performance
        await queryRunner.createIndex(
            'friendships',
            new TableIndex({
                name: 'IDX_FRIENDSHIP_USER_ID',
                columnNames: ['userId'],
            }),
        );

        await queryRunner.createIndex(
            'friendships',
            new TableIndex({
                name: 'IDX_FRIENDSHIP_FRIEND_ID',
                columnNames: ['friendId'],
            }),
        );

        // Create messages table
        await queryRunner.createTable(
            new Table({
                name: 'messages',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    {
                        name: 'fromUserId',
                        type: 'uuid',
                        isNullable: false,
                    },
                    {
                        name: 'toUserId',
                        type: 'uuid',
                        isNullable: false,
                    },
                    {
                        name: 'content',
                        type: 'text',
                        isNullable: false,
                    },
                    {
                        name: 'isRead',
                        type: 'boolean',
                        default: false,
                    },
                    {
                        name: 'readAt',
                        type: 'timestamp',
                        isNullable: true,
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
                    },
                ],
            }),
            true,
        );

        // Create indexes for messages
        await queryRunner.createIndex(
            'messages',
            new TableIndex({
                name: 'IDX_MESSAGE_FROM_USER_ID',
                columnNames: ['fromUserId'],
            }),
        );

        await queryRunner.createIndex(
            'messages',
            new TableIndex({
                name: 'IDX_MESSAGE_TO_USER_ID',
                columnNames: ['toUserId'],
            }),
        );

        // Create online_status table
        await queryRunner.createTable(
            new Table({
                name: 'online_status',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    {
                        name: 'userId',
                        type: 'uuid',
                        isNullable: false,
                        isUnique: true,
                    },
                    {
                        name: 'status',
                        type: 'enum',
                        enum: ['online', 'offline', 'away'],
                        isNullable: false,
                    },
                    {
                        name: 'lastSeen',
                        type: 'timestamp',
                        isNullable: false,
                    },
                    {
                        name: 'currentGame',
                        type: 'varchar',
                        length: '100',
                        isNullable: true,
                    },
                    {
                        name: 'updatedAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true,
        );

        // Create index for online_status
        await queryRunner.createIndex(
            'online_status',
            new TableIndex({
                name: 'IDX_ONLINE_STATUS_USER_ID',
                columnNames: ['userId'],
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('online_status');
        await queryRunner.dropTable('messages');
        await queryRunner.dropTable('friendships');
    }
}