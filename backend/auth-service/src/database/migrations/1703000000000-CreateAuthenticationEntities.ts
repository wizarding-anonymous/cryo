import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthenticationEntities1703000000000 implements MigrationInterface {
  name = 'CreateAuthenticationEntities1703000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create sessions table
    await queryRunner.query(`
      CREATE TABLE "sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "accessToken" text NOT NULL,
        "refreshToken" text NOT NULL,
        "ipAddress" character varying(45) NOT NULL,
        "userAgent" text NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "lastAccessedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id")
      )
    `);

    // Create login_attempts table
    await queryRunner.query(`
      CREATE TABLE "login_attempts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying(255) NOT NULL,
        "userId" uuid,
        "ipAddress" character varying(45) NOT NULL,
        "userAgent" text NOT NULL,
        "successful" boolean NOT NULL DEFAULT false,
        "failureReason" character varying(255),
        "metadata" json,
        "attemptedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_4f0c2be5ac6c8c292d3f4e5e5e5" PRIMARY KEY ("id")
      )
    `);

    // Create token_blacklist table
    await queryRunner.query(`
      CREATE TABLE "token_blacklist" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tokenHash" character varying(64) NOT NULL,
        "userId" uuid NOT NULL,
        "reason" character varying NOT NULL DEFAULT 'logout',
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "metadata" json,
        "blacklistedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_token_blacklist_tokenHash" UNIQUE ("tokenHash"),
        CONSTRAINT "PK_5f0c2be5ac6c8c292d3f4e5e5e6" PRIMARY KEY ("id")
      )
    `);

    // Create security_events table
    await queryRunner.query(`
      CREATE TABLE "security_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "type" character varying NOT NULL,
        "ipAddress" character varying(45) NOT NULL,
        "userAgent" text,
        "metadata" json,
        "processed" boolean NOT NULL DEFAULT false,
        "severity" character varying(50),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_6f0c2be5ac6c8c292d3f4e5e5e7" PRIMARY KEY ("id")
      )
    `);

    // Create enum types
    await queryRunner.query(`
      CREATE TYPE "token_blacklist_reason_enum" AS ENUM('logout', 'security', 'expired', 'refresh', 'admin')
    `);
    
    await queryRunner.query(`
      CREATE TYPE "security_events_type_enum" AS ENUM('registration', 'login', 'logout', 'failed_login', 'password_change', 'token_refresh', 'suspicious_activity', 'account_locked', 'session_expired')
    `);

    // Update tables to use enum types
    // First drop default values, then change type, then restore defaults
    await queryRunner.query(`
      ALTER TABLE "token_blacklist" ALTER COLUMN "reason" DROP DEFAULT
    `);
    
    await queryRunner.query(`
      ALTER TABLE "token_blacklist" ALTER COLUMN "reason" TYPE "token_blacklist_reason_enum" USING "reason"::"token_blacklist_reason_enum"
    `);
    
    await queryRunner.query(`
      ALTER TABLE "token_blacklist" ALTER COLUMN "reason" SET DEFAULT 'logout'
    `);

    await queryRunner.query(`
      ALTER TABLE "security_events" ALTER COLUMN "type" TYPE "security_events_type_enum" USING "type"::"security_events_type_enum"
    `);

    // Create indexes for sessions table
    await queryRunner.query(`CREATE INDEX "IDX_sessions_userId_isActive" ON "sessions" ("userId", "isActive")`);
    await queryRunner.query(`CREATE INDEX "IDX_sessions_accessToken" ON "sessions" ("accessToken")`);
    await queryRunner.query(`CREATE INDEX "IDX_sessions_refreshToken" ON "sessions" ("refreshToken")`);
    await queryRunner.query(`CREATE INDEX "IDX_sessions_userId" ON "sessions" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_sessions_expiresAt" ON "sessions" ("expiresAt")`);

    // Create indexes for login_attempts table
    await queryRunner.query(`CREATE INDEX "IDX_login_attempts_email_attemptedAt" ON "login_attempts" ("email", "attemptedAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_login_attempts_userId_attemptedAt" ON "login_attempts" ("userId", "attemptedAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_login_attempts_ipAddress_attemptedAt" ON "login_attempts" ("ipAddress", "attemptedAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_login_attempts_successful_attemptedAt" ON "login_attempts" ("successful", "attemptedAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_login_attempts_email" ON "login_attempts" ("email")`);
    await queryRunner.query(`CREATE INDEX "IDX_login_attempts_userId" ON "login_attempts" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_login_attempts_ipAddress" ON "login_attempts" ("ipAddress")`);
    await queryRunner.query(`CREATE INDEX "IDX_login_attempts_successful" ON "login_attempts" ("successful")`);
    await queryRunner.query(`CREATE INDEX "IDX_login_attempts_attemptedAt" ON "login_attempts" ("attemptedAt")`);

    // Create indexes for token_blacklist table
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_token_blacklist_tokenHash" ON "token_blacklist" ("tokenHash")`);
    await queryRunner.query(`CREATE INDEX "IDX_token_blacklist_userId_blacklistedAt" ON "token_blacklist" ("userId", "blacklistedAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_token_blacklist_expiresAt" ON "token_blacklist" ("expiresAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_token_blacklist_reason_blacklistedAt" ON "token_blacklist" ("reason", "blacklistedAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_token_blacklist_userId" ON "token_blacklist" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_token_blacklist_reason" ON "token_blacklist" ("reason")`);
    await queryRunner.query(`CREATE INDEX "IDX_token_blacklist_blacklistedAt" ON "token_blacklist" ("blacklistedAt")`);

    // Create indexes for security_events table
    await queryRunner.query(`CREATE INDEX "IDX_security_events_userId_createdAt" ON "security_events" ("userId", "createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_security_events_type_createdAt" ON "security_events" ("type", "createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_security_events_ipAddress_createdAt" ON "security_events" ("ipAddress", "createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_security_events_processed" ON "security_events" ("processed")`);
    await queryRunner.query(`CREATE INDEX "IDX_security_events_userId" ON "security_events" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_security_events_type" ON "security_events" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_security_events_ipAddress" ON "security_events" ("ipAddress")`);
    await queryRunner.query(`CREATE INDEX "IDX_security_events_createdAt" ON "security_events" ("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE "security_events"`);
    await queryRunner.query(`DROP TABLE "token_blacklist"`);
    await queryRunner.query(`DROP TABLE "login_attempts"`);
    await queryRunner.query(`DROP TABLE "sessions"`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE "security_events_type_enum"`);
    await queryRunner.query(`DROP TYPE "token_blacklist_reason_enum"`);
  }
}