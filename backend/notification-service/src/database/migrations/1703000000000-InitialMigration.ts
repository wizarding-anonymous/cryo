import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1703000000000 implements MigrationInterface {
  name = 'InitialMigration1703000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create notification_type enum
    await queryRunner.query(`
      CREATE TYPE "notification_type_enum" AS ENUM(
        'friend_request', 
        'game_update', 
        'achievement', 
        'purchase', 
        'system'
      )
    `);

    // Create notification_priority enum
    await queryRunner.query(`
      CREATE TYPE "notification_priority_enum" AS ENUM('normal', 'high')
    `);

    // Create notifications table
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "type" "notification_type_enum" NOT NULL,
        "title" character varying(200) NOT NULL,
        "message" text NOT NULL,
        "isRead" boolean NOT NULL DEFAULT false,
        "priority" "notification_priority_enum" NOT NULL DEFAULT 'normal',
        "metadata" jsonb,
        "channels" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "expiresAt" TIMESTAMP,
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )
    `);

    // Create notification_settings table
    await queryRunner.query(`
      CREATE TABLE "notification_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "inAppNotifications" boolean NOT NULL DEFAULT true,
        "emailNotifications" boolean NOT NULL DEFAULT true,
        "friendRequests" boolean NOT NULL DEFAULT true,
        "gameUpdates" boolean NOT NULL DEFAULT true,
        "achievements" boolean NOT NULL DEFAULT true,
        "purchases" boolean NOT NULL DEFAULT true,
        "systemNotifications" boolean NOT NULL DEFAULT true,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_settings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_settings_userId" UNIQUE ("userId")
      )
    `);

    // Create indexes for notifications table
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_userId" ON "notifications" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_type" ON "notifications" ("type")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_createdAt" ON "notifications" ("createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_userId_createdAt" ON "notifications" ("userId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_userId_type" ON "notifications" ("userId", "type")
    `);

    // Create index for notification_settings table
    await queryRunner.query(`
      CREATE INDEX "IDX_notification_settings_userId" ON "notification_settings" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_notification_settings_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_userId_type"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_userId_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_type"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_userId"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "notification_settings"`);
    await queryRunner.query(`DROP TABLE "notifications"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "notification_priority_enum"`);
    await queryRunner.query(`DROP TYPE "notification_type_enum"`);
  }
}