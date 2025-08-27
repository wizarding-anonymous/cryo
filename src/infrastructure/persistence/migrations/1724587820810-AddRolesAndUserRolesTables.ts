import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRolesAndUserRolesTables1724587820810 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "roles" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "name" VARCHAR(50) UNIQUE NOT NULL,
                "description" TEXT,
                "permissions" TEXT[] NOT NULL DEFAULT '{}',
                "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE TABLE "user_roles" (
                "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
                "role_id" UUID NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
                "assigned_at" TIMESTAMP NOT NULL DEFAULT NOW(),
                "assigned_by" UUID REFERENCES "users"("id"),
                "expires_at" TIMESTAMP,
                PRIMARY KEY ("user_id", "role_id")
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE "user_roles";
            DROP TABLE "roles";
        `);
    }

}
