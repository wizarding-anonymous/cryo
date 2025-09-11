import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGameTable1694000000000 implements MigrationInterface {
  name = 'CreateGameTable1694000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    await queryRunner.query(`
      CREATE TABLE "games" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(255) NOT NULL,
        "description" text,
        "shortDescription" character varying(500),
        "price" numeric(10,2) NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'RUB',
        "genre" character varying(100),
        "developer" character varying(255),
        "publisher" character varying(255),
        "releaseDate" date,
        "images" text array NOT NULL DEFAULT '{}',
        "systemRequirements" jsonb,
        "available" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_c9b16b62917b5595af982d66337" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for better performance
    await queryRunner.query(`
      CREATE INDEX "IDX_games_title_search" ON "games" USING gin(to_tsvector('russian', "title"));
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_games_available" ON "games" ("available");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_games_genre" ON "games" ("genre");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_games_price" ON "games" ("price");
    `);

    // Insert sample data for testing
    await queryRunner.query(`
      INSERT INTO "games" (
        "title", 
        "description", 
        "shortDescription", 
        "price", 
        "currency", 
        "genre", 
        "developer", 
        "publisher", 
        "releaseDate", 
        "images", 
        "systemRequirements", 
        "available"
      ) VALUES 
      (
        'Cyberpunk 2077', 
        'Cyberpunk 2077 — это приключенческая ролевая игра с открытым миром, действие которой происходит в Найт-Сити, мегаполисе, одержимом властью, гламуром и модификациями тела.', 
        'Приключенческая RPG в мире киберпанка', 
        2999.00, 
        'RUB', 
        'RPG', 
        'CD Projekt RED', 
        'CD Projekt', 
        '2020-12-10', 
        ARRAY['https://example.com/cyberpunk1.jpg', 'https://example.com/cyberpunk2.jpg'], 
        '{"minimum": "OS: Windows 10 64-bit, Processor: Intel Core i5-3570K or AMD FX-8310, Memory: 8 GB RAM", "recommended": "OS: Windows 10 64-bit, Processor: Intel Core i7-4790 or AMD Ryzen 3 3200G, Memory: 12 GB RAM"}', 
        true
      ),
      (
        'The Witcher 3: Wild Hunt', 
        'Ведьмак 3: Дикая Охота — это сюжетно-ориентированная ролевая игра с открытым миром, действие которой происходит в визуально потрясающей фэнтезийной вселенной.', 
        'Эпическая RPG в мире фэнтези', 
        1499.00, 
        'RUB', 
        'RPG', 
        'CD Projekt RED', 
        'CD Projekt', 
        '2015-05-19', 
        ARRAY['https://example.com/witcher1.jpg', 'https://example.com/witcher2.jpg'], 
        '{"minimum": "OS: Windows 7 64-bit, Processor: Intel CPU Core i5-2500K 3.3GHz, Memory: 6 GB RAM", "recommended": "OS: Windows 10 64-bit, Processor: Intel CPU Core i7 3770 3,4 GHz, Memory: 8 GB RAM"}', 
        true
      ),
      (
        'Red Dead Redemption 2', 
        'Red Dead Redemption 2 — это эпическая история о жизни в Америке на заре современной эпохи.', 
        'Вестерн-экшен в открытом мире', 
        3499.00, 
        'RUB', 
        'Action', 
        'Rockstar Games', 
        'Rockstar Games', 
        '2019-11-05', 
        ARRAY['https://example.com/rdr1.jpg', 'https://example.com/rdr2.jpg'], 
        '{"minimum": "OS: Windows 7 SP1 64bit, Processor: Intel Core i5-2500K / AMD FX-6300, Memory: 8 GB RAM", "recommended": "OS: Windows 10 64bit, Processor: Intel Core i7-4770K / AMD Ryzen 5 1500X, Memory: 12 GB RAM"}', 
        true
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_games_price"`);
    await queryRunner.query(`DROP INDEX "IDX_games_genre"`);
    await queryRunner.query(`DROP INDEX "IDX_games_available"`);
    await queryRunner.query(`DROP INDEX "IDX_games_title_search"`);
    await queryRunner.query(`DROP TABLE "games"`);
  }
}