import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1703001000000 implements MigrationInterface {
  name = 'InitialSchema1703001000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    
    // Enable full-text search extensions for Russian language
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "unaccent"`);
    
    // Create custom text search configuration for Russian
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'russian_unaccent') THEN
          CREATE TEXT SEARCH CONFIGURATION russian_unaccent (COPY = russian);
          ALTER TEXT SEARCH CONFIGURATION russian_unaccent
            ALTER MAPPING FOR hword, hword_part, word WITH unaccent, russian_stem;
        END IF;
      END
      $$;
    `);

    // Create categories table
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(100) NOT NULL,
        "slug" character varying(100) NOT NULL,
        "description" text,
        "parentId" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_420d9f679d41281f282f5bc7d09" UNIQUE ("slug")
      )
    `);

    // Create tags table
    await queryRunner.query(`
      CREATE TABLE "tags" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(50) NOT NULL,
        "slug" character varying(50) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_e7dc17249a1148a1970748eda99" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_d90243459a697eadb8ad56e9092" UNIQUE ("name"),
        CONSTRAINT "UQ_5e7dc17249a1148a1970748eda99" UNIQUE ("slug")
      )
    `);

    // Create games table with full-text search
    await queryRunner.query(`
      CREATE TABLE "games" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(255) NOT NULL,
        "slug" character varying(255) NOT NULL,
        "description" text,
        "shortDescription" text,
        "developerId" uuid NOT NULL,
        "publisherId" uuid,
        "price" numeric(10,2) NOT NULL DEFAULT '0',
        "isFree" boolean NOT NULL DEFAULT false,
        "releaseDate" date,
        "status" character varying NOT NULL DEFAULT 'draft',
        "minimumOs" character varying,
        "minimumProcessor" character varying,
        "minimumMemory" character varying,
        "minimumGraphics" character varying,
        "minimumStorage" character varying,
        "recommendedOs" character varying,
        "recommendedProcessor" character varying,
        "recommendedMemory" character varying,
        "recommendedGraphics" character varying,
        "recommendedStorage" character varying,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "search_vector" tsvector,
        CONSTRAINT "PK_c9b16b62917b5595af982d66337" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_c9b16b62917b5595af982d66338" UNIQUE ("slug"),
        CONSTRAINT "CHK_game_status" CHECK ("status" IN ('draft', 'pending_review', 'published', 'rejected', 'archived'))
      )
    `);

    // Create franchises table
    await queryRunner.query(`
      CREATE TABLE "franchises" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "description" text,
        CONSTRAINT "PK_franchises" PRIMARY KEY ("id")
      )
    `);

    // Create bundles table
    await queryRunner.query(`
      CREATE TABLE "bundles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "description" text,
        "price" numeric(10,2) NOT NULL,
        CONSTRAINT "PK_bundles" PRIMARY KEY ("id")
      )
    `);

    // Create preorders table
    await queryRunner.query(`
      CREATE TABLE "preorders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "gameId" uuid NOT NULL,
        "startDate" TIMESTAMP WITH TIME ZONE NOT NULL,
        "releaseDate" TIMESTAMP WITH TIME ZONE NOT NULL,
        "isAvailable" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_preorders" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_preorders_game" UNIQUE ("gameId")
      )
    `);

    // Create preorder_tiers table
    await queryRunner.query(`
      CREATE TABLE "preorder_tiers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "preorderId" uuid NOT NULL,
        "name" character varying(50) NOT NULL,
        "price" numeric(10,2) NOT NULL,
        "bonuses" jsonb,
        CONSTRAINT "PK_preorder_tiers" PRIMARY KEY ("id")
      )
    `);

    // Create demos table
    await queryRunner.query(`
      CREATE TABLE "demos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "gameId" uuid NOT NULL,
        "type" character varying NOT NULL,
        "timeLimitMinutes" integer,
        "contentDescription" text,
        "downloadUrl" character varying(500),
        "isAvailable" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_demos" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_demos_game" UNIQUE ("gameId"),
        CONSTRAINT "CHK_demo_type" CHECK ("type" IN ('time_limited', 'content_limited', 'cloud_demo'))
      )
    `);

    // Create game_editions table
    await queryRunner.query(`
      CREATE TABLE "game_editions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "gameId" uuid NOT NULL,
        "name" character varying(100) NOT NULL,
        "price" numeric(10,2) NOT NULL,
        "content" jsonb,
        CONSTRAINT "PK_game_editions" PRIMARY KEY ("id")
      )
    `);

    // Create dlcs table
    await queryRunner.query(`
      CREATE TABLE "dlcs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "baseGameId" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "description" text,
        "price" numeric(10,2) NOT NULL DEFAULT '0',
        "releaseDate" date,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dlcs" PRIMARY KEY ("id")
      )
    `);

    // Create game_screenshots table
    await queryRunner.query(`
      CREATE TABLE "game_screenshots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "gameId" uuid NOT NULL,
        "url" character varying(500) NOT NULL,
        "thumbnailUrl" character varying(500),
        "caption" character varying(255),
        "sortOrder" integer NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_game_screenshots" PRIMARY KEY ("id")
      )
    `);

    // Create game_videos table
    await queryRunner.query(`
      CREATE TABLE "game_videos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "gameId" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "url" character varying(500) NOT NULL,
        "thumbnailUrl" character varying(500),
        "duration" integer,
        "videoType" character varying(20) NOT NULL DEFAULT 'trailer',
        "sortOrder" integer NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_game_videos" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_video_type" CHECK ("videoType" IN ('trailer', 'gameplay', 'review'))
      )
    `);

    // Create game_discounts table
    await queryRunner.query(`
      CREATE TABLE "game_discounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "gameId" uuid NOT NULL,
        "percentage" integer NOT NULL,
        "startDate" TIMESTAMP WITH TIME ZONE NOT NULL,
        "endDate" TIMESTAMP WITH TIME ZONE NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_game_discounts" PRIMARY KEY ("id")
      )
    `);

    // Create game_translations table
    await queryRunner.query(`
      CREATE TABLE "game_translations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "gameId" uuid NOT NULL,
        "languageCode" character varying(10) NOT NULL,
        "title" character varying(255) NOT NULL,
        "description" text,
        "shortDescription" text,
        CONSTRAINT "PK_game_translations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_game_translations_game_lang" UNIQUE ("gameId", "languageCode")
      )
    `);

    // Create many-to-many junction tables
    await queryRunner.query(`
      CREATE TABLE "game_categories" (
        "game_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        CONSTRAINT "PK_game_categories" PRIMARY KEY ("game_id", "category_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "game_tags" (
        "game_id" uuid NOT NULL,
        "tag_id" uuid NOT NULL,
        CONSTRAINT "PK_game_tags" PRIMARY KEY ("game_id", "tag_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "bundle_games" (
        "bundle_id" uuid NOT NULL,
        "game_id" uuid NOT NULL,
        CONSTRAINT "PK_bundle_games" PRIMARY KEY ("bundle_id", "game_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "franchise_games" (
        "franchise_id" uuid NOT NULL,
        "game_id" uuid NOT NULL,
        CONSTRAINT "PK_franchise_games" PRIMARY KEY ("franchise_id", "game_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop junction tables first
    await queryRunner.query(`DROP TABLE "franchise_games"`);
    await queryRunner.query(`DROP TABLE "bundle_games"`);
    await queryRunner.query(`DROP TABLE "game_tags"`);
    await queryRunner.query(`DROP TABLE "game_categories"`);
    
    // Drop dependent tables
    await queryRunner.query(`DROP TABLE "game_translations"`);
    await queryRunner.query(`DROP TABLE "game_discounts"`);
    await queryRunner.query(`DROP TABLE "game_videos"`);
    await queryRunner.query(`DROP TABLE "game_screenshots"`);
    await queryRunner.query(`DROP TABLE "dlcs"`);
    await queryRunner.query(`DROP TABLE "game_editions"`);
    await queryRunner.query(`DROP TABLE "demos"`);
    await queryRunner.query(`DROP TABLE "preorder_tiers"`);
    await queryRunner.query(`DROP TABLE "preorders"`);
    
    // Drop main tables
    await queryRunner.query(`DROP TABLE "bundles"`);
    await queryRunner.query(`DROP TABLE "franchises"`);
    await queryRunner.query(`DROP TABLE "games"`);
    await queryRunner.query(`DROP TABLE "tags"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    
    // Drop custom text search configuration
    await queryRunner.query(`DROP TEXT SEARCH CONFIGURATION IF EXISTS russian_unaccent`);
  }
}