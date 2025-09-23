import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1703000000000 implements MigrationInterface {
  name = 'InitialMigration1703000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create friendships table
    await queryRunner.query(`
      CREATE TYPE "friendship_status_enum" AS ENUM('pending', 'accepted', 'declined', 'blocked')
    `);

    await queryRunner.query(`
      CREATE TABLE "friendships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "friendId" uuid NOT NULL,
        "status" "friendship_status_enum" NOT NULL DEFAULT 'pending',
        "requestedBy" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_friendships" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_friendships_no_self" CHECK ("userId" != "friendId"),
        CONSTRAINT "UQ_friendships_user_friend" UNIQUE ("userId", "friendId")
      )
    `);

    // Create indexes for friendships
    await queryRunner.query(`CREATE INDEX "IDX_friendships_userId" ON "friendships" ("userId")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_friendships_friendId" ON "friendships" ("friendId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_friendships_userId_status" ON "friendships" ("userId", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_friendships_friendId_status" ON "friendships" ("friendId", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_friendships_requestedBy" ON "friendships" ("requestedBy")`,
    );

    // Create messages table
    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "fromUserId" uuid NOT NULL,
        "toUserId" uuid NOT NULL,
        "content" character varying(1000) NOT NULL,
        "isRead" boolean NOT NULL DEFAULT false,
        "readAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_messages" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_messages_no_self" CHECK ("fromUserId" != "toUserId")
      )
    `);

    // Create indexes for messages
    await queryRunner.query(`CREATE INDEX "IDX_messages_fromUserId" ON "messages" ("fromUserId")`);
    await queryRunner.query(`CREATE INDEX "IDX_messages_toUserId" ON "messages" ("toUserId")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_conversation" ON "messages" ("fromUserId", "toUserId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_unread" ON "messages" ("toUserId", "isRead")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_sent" ON "messages" ("fromUserId", "createdAt")`,
    );

    // Create online_status table
    await queryRunner.query(`
      CREATE TYPE "user_status_enum" AS ENUM('online', 'offline', 'away')
    `);

    await queryRunner.query(`
      CREATE TABLE "online_status" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "status" "user_status_enum" NOT NULL DEFAULT 'offline',
        "lastSeen" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "currentGame" character varying(100),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_online_status" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_online_status_userId" UNIQUE ("userId")
      )
    `);

    // Create indexes for online_status
    await queryRunner.query(
      `CREATE INDEX "IDX_online_status_userId" ON "online_status" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_online_status_status" ON "online_status" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_online_status_lastSeen" ON "online_status" ("lastSeen")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE "online_status"`);
    await queryRunner.query(`DROP TYPE "user_status_enum"`);

    await queryRunner.query(`DROP TABLE "messages"`);

    await queryRunner.query(`DROP TABLE "friendships"`);
    await queryRunner.query(`DROP TYPE "friendship_status_enum"`);
  }
}
