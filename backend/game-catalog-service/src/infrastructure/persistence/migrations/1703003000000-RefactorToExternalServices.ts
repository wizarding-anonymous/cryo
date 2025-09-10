import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorToExternalServices1703003000000 implements MigrationInterface {
  name = 'RefactorToExternalServices1703003000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Удаляем таблицы предзаказов (функционал перенесен в Preorder Service)
    await queryRunner.query(`DROP TABLE IF EXISTS "preorder_tiers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "preorders"`);

    // Создаем таблицу для статусов жизненного цикла игр
    await queryRunner.query(`
      CREATE TABLE "game_lifecycle_status" (
        "gameId" uuid NOT NULL,
        "status" character varying NOT NULL DEFAULT 'draft',
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedBy" uuid NOT NULL,
        CONSTRAINT "PK_game_lifecycle_status" PRIMARY KEY ("gameId"),
        CONSTRAINT "CHK_lifecycle_status" CHECK ("status" IN ('draft', 'in_development', 'alpha', 'beta', 'early_access', 'coming_soon', 'released', 'discontinued')),
        CONSTRAINT "FK_game_lifecycle_status_game" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE
      )
    `);

    // Создаем таблицу для roadmap игр
    await queryRunner.query(`
      CREATE TABLE "game_roadmaps" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "gameId" uuid NOT NULL,
        "milestoneName" character varying(255) NOT NULL,
        "description" text,
        "targetDate" date,
        "status" character varying NOT NULL DEFAULT 'planned',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_game_roadmaps" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_roadmap_status" CHECK ("status" IN ('planned', 'in_progress', 'completed', 'cancelled')),
        CONSTRAINT "FK_game_roadmaps_game" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE
      )
    `);

    // Создаем таблицу для промо-акций
    await queryRunner.query(`
      CREATE TABLE "promotions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(255) NOT NULL,
        "description" text,
        "discountPercentage" integer NOT NULL,
        "type" character varying NOT NULL,
        "startDate" TIMESTAMP WITH TIME ZONE NOT NULL,
        "endDate" TIMESTAMP WITH TIME ZONE NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_promotions" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_promotion_type" CHECK ("type" IN ('seasonal', 'flash', 'weekend', 'holiday')),
        CONSTRAINT "CHK_discount_percentage" CHECK ("discountPercentage" > 0 AND "discountPercentage" <= 100)
      )
    `);

    // Создаем связующую таблицу для игр и промо-акций
    await queryRunner.query(`
      CREATE TABLE "game_promotions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "gameId" uuid NOT NULL,
        "promotionId" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_game_promotions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_game_promotions" UNIQUE ("gameId", "promotionId"),
        CONSTRAINT "FK_game_promotions_game" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_promotions_promotion" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE
      )
    `);

    // Создаем индексы для новых таблиц
    await queryRunner.query(`CREATE INDEX "IDX_game_lifecycle_status" ON "game_lifecycle_status" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_game_roadmaps_game" ON "game_roadmaps" ("gameId")`);
    await queryRunner.query(`CREATE INDEX "IDX_game_roadmaps_status" ON "game_roadmaps" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_promotions_active" ON "promotions" ("isActive") WHERE "isActive" = true`);
    await queryRunner.query(`CREATE INDEX "IDX_promotions_dates" ON "promotions" ("startDate", "endDate")`);
    await queryRunner.query(`CREATE INDEX "IDX_promotions_type" ON "promotions" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_game_promotions_game" ON "game_promotions" ("gameId")`);
    await queryRunner.query(`CREATE INDEX "IDX_game_promotions_promotion" ON "game_promotions" ("promotionId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем новые таблицы
    await queryRunner.query(`DROP TABLE IF EXISTS "game_promotions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "promotions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_roadmaps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_lifecycle_status"`);

    // Восстанавливаем таблицы предзаказов (если нужно откатиться)
    await queryRunner.query(`
      CREATE TABLE "preorders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "gameId" uuid NOT NULL,
        "startDate" TIMESTAMP WITH TIME ZONE NOT NULL,
        "releaseDate" TIMESTAMP WITH TIME ZONE NOT NULL,
        "isAvailable" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_preorders" PRIMARY KEY ("id"),
        CONSTRAINT "FK_preorders_game" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "preorder_tiers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "preorderId" uuid NOT NULL,
        "name" character varying(50) NOT NULL,
        "price" numeric(10,2) NOT NULL,
        "bonuses" jsonb,
        CONSTRAINT "PK_preorder_tiers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_preorder_tiers_preorder" FOREIGN KEY ("preorderId") REFERENCES "preorders"("id") ON DELETE CASCADE
      )
    `);

    // Восстанавливаем индексы для предзаказов
    await queryRunner.query(`CREATE INDEX "IDX_preorders_game" ON "preorders" ("gameId")`);
    await queryRunner.query(`CREATE INDEX "IDX_preorder_tiers_preorder" ON "preorder_tiers" ("preorderId")`);
  }
}