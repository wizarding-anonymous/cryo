import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialEntities1726050271000 implements MigrationInterface {
  name = 'InitialEntities1726050271000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "orders" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" character varying NOT NULL,
                "game_id" character varying NOT NULL,
                "game_name" character varying NOT NULL,
                "amount" numeric(10, 2) NOT NULL,
                "currency" character varying NOT NULL DEFAULT 'RUB',
                "status" "public"."orders_status_enum" NOT NULL DEFAULT 'pending',
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_a922b820ee829917252d43cb0d" ON "orders" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e834d6e539c315e34743c6806e" ON "orders" ("status") `,
    );

    await queryRunner.query(`
            CREATE TABLE "payments" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "order_id" uuid NOT NULL,
                "external_id" character varying,
                "amount" numeric(10, 2) NOT NULL,
                "currency" character varying NOT NULL DEFAULT 'RUB',
                "provider" "public"."payments_provider_enum" NOT NULL,
                "status" "public"."payments_status_enum" NOT NULL DEFAULT 'pending',
                "provider_response" jsonb,
                "failure_reason" character varying,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "completed_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_899918a1829e2621a116551b2a" ON "payments" ("order_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_42c847627a19999718428109c9" ON "payments" ("external_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_394b6bf5546d101a031d680f48" ON "payments" ("status") `,
    );

    await queryRunner.query(`
            ALTER TABLE "payments"
            ADD CONSTRAINT "FK_899918a1829e2621a116551b2a1" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_899918a1829e2621a116551b2a1"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_394b6bf5546d101a031d680f48"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_42c847627a19999718428109c9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_899918a1829e2621a116551b2a"`,
    );
    await queryRunner.query(`DROP TABLE "payments"`);

    await queryRunner.query(
      `DROP INDEX "public"."IDX_e834d6e539c315e34743c6806e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a922b820ee829917252d43cb0d"`,
    );
    await queryRunner.query(`DROP TABLE "orders"`);
  }
}
