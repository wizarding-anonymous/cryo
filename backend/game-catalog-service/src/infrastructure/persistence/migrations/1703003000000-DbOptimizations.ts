import { MigrationInterface, QueryRunner } from 'typeorm';

export class DbOptimizations1703003000000 implements MigrationInterface {
  name = 'DbOptimizations1703003000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add games_count columns
    await queryRunner.query(`ALTER TABLE "categories" ADD "games_count" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "tags" ADD "games_count" integer NOT NULL DEFAULT 0`);

    // --- Category games_count trigger ---

    // 1. Create the function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_category_games_count()
      RETURNS TRIGGER AS $$
      BEGIN
        IF (TG_OP = 'INSERT') THEN
          UPDATE "categories" SET games_count = games_count + 1 WHERE id = NEW.category_id;
        ELSIF (TG_OP = 'DELETE') THEN
          UPDATE "categories" SET games_count = games_count - 1 WHERE id = OLD.category_id;
        END IF;
        RETURN NULL; -- result is ignored since this is an AFTER trigger
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 2. Create the trigger
    await queryRunner.query(`
      CREATE TRIGGER trigger_update_category_games_count
      AFTER INSERT OR DELETE ON "game_categories"
      FOR EACH ROW EXECUTE FUNCTION update_category_games_count();
    `);

    // --- Tag games_count trigger ---

    // 1. Create the function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_tag_games_count()
      RETURNS TRIGGER AS $$
      BEGIN
        IF (TG_OP = 'INSERT') THEN
          UPDATE "tags" SET games_count = games_count + 1 WHERE id = NEW.tag_id;
        ELSIF (TG_OP = 'DELETE') THEN
          UPDATE "tags" SET games_count = games_count - 1 WHERE id = OLD.tag_id;
        END IF;
        RETURN NULL; -- result is ignored since this is an AFTER trigger
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 2. Create the trigger
    await queryRunner.query(`
      CREATE TRIGGER trigger_update_tag_games_count
      AFTER INSERT OR DELETE ON "game_tags"
      FOR EACH ROW EXECUTE FUNCTION update_tag_games_count();
    `);

    // 3. Backfill the initial counts
    await queryRunner.query(`
      UPDATE "categories" SET games_count = (
        SELECT COUNT(*) FROM "game_categories" WHERE "category_id" = "categories"."id"
      );
    `);
    await queryRunner.query(`
      UPDATE "tags" SET games_count = (
        SELECT COUNT(*) FROM "game_tags" WHERE "tag_id" = "tags"."id"
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(`DROP TRIGGER "trigger_update_tag_games_count" ON "game_tags"`);
    await queryRunner.query(`DROP TRIGGER "trigger_update_category_games_count" ON "game_categories"`);

    // Drop functions
    await queryRunner.query(`DROP FUNCTION "update_tag_games_count"()`);
    await queryRunner.query(`DROP FUNCTION "update_category_games_count"()`);

    // Drop columns
    await queryRunner.query(`ALTER TABLE "tags" DROP COLUMN "games_count"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "games_count"`);
  }
}
