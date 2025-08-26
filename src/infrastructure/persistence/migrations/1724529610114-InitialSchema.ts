import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1724529610114 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            -- Create users table
            CREATE TABLE "users" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "email" VARCHAR(255) UNIQUE NOT NULL,
                "username" VARCHAR(50) UNIQUE NOT NULL,
                "password_hash" VARCHAR(255) NOT NULL,
                "email_verified" BOOLEAN DEFAULT FALSE,
                "phone_number" VARCHAR(20),
                "phone_verified" BOOLEAN DEFAULT FALSE,
                "profile" JSONB NOT NULL DEFAULT '{}',
                "privacy_settings" JSONB NOT NULL DEFAULT '{}',
                "notification_settings" JSONB NOT NULL DEFAULT '{}',
                "mfa_enabled" BOOLEAN DEFAULT FALSE,
                "mfa_methods" JSONB DEFAULT '[]',
                "backup_codes" TEXT[],
                "is_active" BOOLEAN DEFAULT TRUE,
                "is_blocked" BOOLEAN DEFAULT FALSE,
                "block_reason" TEXT,
                "block_expires_at" TIMESTAMP,
                "reputation_score" INTEGER DEFAULT 0,
                "created_at" TIMESTAMP DEFAULT NOW(),
                "updated_at" TIMESTAMP DEFAULT NOW(),
                "last_login_at" TIMESTAMP
            );

            -- Create user_sessions table
            CREATE TABLE "user_sessions" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
                "device_info" JSONB NOT NULL,
                "ip_address" INET NOT NULL,
                "user_agent" TEXT,
                "access_token_hash" VARCHAR(255) NOT NULL,
                "refresh_token_hash" VARCHAR(255) NOT NULL,
                "created_at" TIMESTAMP DEFAULT NOW(),
                "last_activity_at" TIMESTAMP DEFAULT NOW(),
                "expires_at" TIMESTAMP NOT NULL,
                "is_active" BOOLEAN DEFAULT TRUE
            );

            -- Create social_accounts table
            CREATE TABLE "social_accounts" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
                "provider" VARCHAR(50) NOT NULL,
                "provider_user_id" VARCHAR(255) NOT NULL,
                "provider_data" JSONB,
                "linked_at" TIMESTAMP DEFAULT NOW(),
                UNIQUE("provider", "provider_user_id")
            );

            -- Create developer_profiles table
            CREATE TABLE "developer_profiles" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
                "company_name" VARCHAR(255) NOT NULL,
                "company_type" VARCHAR(50) NOT NULL,
                "inn" VARCHAR(12),
                "ogrn" VARCHAR(15),
                "legal_address" TEXT,
                "contact_email" VARCHAR(255) NOT NULL,
                "contact_phone" VARCHAR(20),
                "website" VARCHAR(255),
                "studio_info" JSONB NOT NULL DEFAULT '{}',
                "portfolio" JSONB NOT NULL DEFAULT '{}',
                "stats" JSONB NOT NULL DEFAULT '{}',
                "social" JSONB NOT NULL DEFAULT '{}',
                "profile_settings" JSONB NOT NULL DEFAULT '{}',
                "is_verified" BOOLEAN DEFAULT FALSE,
                "verification_status" VARCHAR(20) DEFAULT 'pending',
                "verification_documents" JSONB DEFAULT '[]',
                "verified_at" TIMESTAMP,
                "created_at" TIMESTAMP DEFAULT NOW(),
                "updated_at" TIMESTAMP DEFAULT NOW(),
                UNIQUE("user_id")
            );

            -- Create publisher_profiles table
            CREATE TABLE "publisher_profiles" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
                "company_name" VARCHAR(255) NOT NULL,
                "company_type" VARCHAR(50) NOT NULL,
                "corporate_info" JSONB NOT NULL DEFAULT '{}',
                "contacts" JSONB NOT NULL DEFAULT '{}',
                "branding" JSONB NOT NULL DEFAULT '{}',
                "studios" JSONB NOT NULL DEFAULT '{}',
                "portfolio" JSONB NOT NULL DEFAULT '{}',
                "analytics" JSONB NOT NULL DEFAULT '{}',
                "verification" JSONB NOT NULL DEFAULT '{}',
                "created_at" TIMESTAMP DEFAULT NOW(),
                "updated_at" TIMESTAMP DEFAULT NOW(),
                UNIQUE("user_id")
            );

            -- Create corporate_profiles table
            CREATE TABLE "corporate_profiles" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "admin_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
                "company_info" JSONB NOT NULL DEFAULT '{}',
                "organization" JSONB NOT NULL DEFAULT '{}',
                "subscription" JSONB NOT NULL DEFAULT '{}',
                "integrations" JSONB NOT NULL DEFAULT '{}',
                "policies" JSONB NOT NULL DEFAULT '{}',
                "usage" JSONB NOT NULL DEFAULT '{}',
                "created_at" TIMESTAMP DEFAULT NOW(),
                "updated_at" TIMESTAMP DEFAULT NOW(),
                UNIQUE("admin_user_id")
            );

            -- Performance Indexes
            CREATE INDEX "idx_users_email" ON "users"("email");
            CREATE INDEX "idx_users_username" ON "users"("username");
            CREATE INDEX "idx_users_active" ON "users"("is_active") WHERE "is_active" = TRUE;
            CREATE INDEX "idx_sessions_user_active" ON "user_sessions"("user_id", "is_active") WHERE "is_active" = TRUE;
            CREATE INDEX "idx_sessions_expires" ON "user_sessions"("expires_at");
            CREATE INDEX "idx_social_accounts_user" ON "social_accounts"("user_id");

            -- Triggers for updated_at
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language 'plpgsql';

            CREATE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "users"
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

            CREATE TRIGGER "update_developer_profiles_updated_at" BEFORE UPDATE ON "developer_profiles"
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

            CREATE TRIGGER "update_publisher_profiles_updated_at" BEFORE UPDATE ON "publisher_profiles"
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

            CREATE TRIGGER "update_corporate_profiles_updated_at" BEFORE UPDATE ON "corporate_profiles"
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            -- Drop triggers
            DROP TRIGGER IF EXISTS "update_corporate_profiles_updated_at" ON "corporate_profiles";
            DROP TRIGGER IF EXISTS "update_publisher_profiles_updated_at" ON "publisher_profiles";
            DROP TRIGGER IF EXISTS "update_developer_profiles_updated_at" ON "developer_profiles";
            DROP TRIGGER IF EXISTS "update_users_updated_at" ON "users";

            -- Drop function
            DROP FUNCTION IF EXISTS update_updated_at_column();

            -- Drop indexes
            DROP INDEX IF EXISTS "idx_social_accounts_user";
            DROP INDEX IF EXISTS "idx_sessions_expires";
            DROP INDEX IF EXISTS "idx_sessions_user_active";
            DROP INDEX IF EXISTS "idx_users_active";
            DROP INDEX IF EXISTS "idx_users_username";
            DROP INDEX IF EXISTS "idx_users_email";

            -- Drop tables
            DROP TABLE "corporate_profiles";
            DROP TABLE "publisher_profiles";
            DROP TABLE "developer_profiles";
            DROP TABLE "social_accounts";
            DROP TABLE "user_sessions";
            DROP TABLE "users";
        `);
    }

}
