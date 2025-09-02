-- Database initialization script for Game Catalog Service
-- This script sets up the database with initial data and configurations

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Create custom text search configuration for Russian language
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'russian_unaccent') THEN
    CREATE TEXT SEARCH CONFIGURATION russian_unaccent (COPY = russian);
    ALTER TEXT SEARCH CONFIGURATION russian_unaccent
      ALTER MAPPING FOR hword, hword_part, word WITH unaccent, russian_stem;
  END IF;
END
$$;

-- Insert initial categories
INSERT INTO categories (id, name, slug, description, "parentId") VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Экшен', 'action', 'Игры с динамичным геймплеем и боевыми действиями', NULL),
  ('550e8400-e29b-41d4-a716-446655440002', 'Приключения', 'adventure', 'Игры с исследованием мира и решением головоломок', NULL),
  ('550e8400-e29b-41d4-a716-446655440003', 'РПГ', 'rpg', 'Ролевые игры с развитием персонажа', NULL),
  ('550e8400-e29b-41d4-a716-446655440004', 'Стратегия', 'strategy', 'Игры, требующие стратегического мышления', NULL),
  ('550e8400-e29b-41d4-a716-446655440005', 'Симуляторы', 'simulation', 'Игры, имитирующие реальные процессы', NULL),
  ('550e8400-e29b-41d4-a716-446655440006', 'Спорт', 'sports', 'Спортивные игры и симуляторы', NULL),
  ('550e8400-e29b-41d4-a716-446655440007', 'Гонки', 'racing', 'Автомобильные и другие виды гонок', NULL),
  ('550e8400-e29b-41d4-a716-446655440008', 'Инди', 'indie', 'Независимые игры от малых студий', NULL),
  ('550e8400-e29b-41d4-a716-446655440009', 'Казуальные', 'casual', 'Простые игры для широкой аудитории', NULL),
  ('550e8400-e29b-41d4-a716-446655440010', 'Многопользовательские', 'multiplayer', 'Игры для нескольких игроков', NULL);

-- Insert subcategories for Action
INSERT INTO categories (id, name, slug, description, "parentId") VALUES
  ('550e8400-e29b-41d4-a716-446655440011', 'Шутеры', 'shooters', 'Игры с огнестрельным оружием', '550e8400-e29b-41d4-a716-446655440001'),
  ('550e8400-e29b-41d4-a716-446655440012', 'Файтинги', 'fighting', 'Игры рукопашного боя', '550e8400-e29b-41d4-a716-446655440001'),
  ('550e8400-e29b-41d4-a716-446655440013', 'Платформеры', 'platformers', 'Игры с прыжками по платформам', '550e8400-e29b-41d4-a716-446655440001');

-- Insert subcategories for Strategy
INSERT INTO categories (id, name, slug, description, "parentId") VALUES
  ('550e8400-e29b-41d4-a716-446655440014', 'RTS', 'rts', 'Стратегии в реальном времени', '550e8400-e29b-41d4-a716-446655440004'),
  ('550e8400-e29b-41d4-a716-446655440015', 'Пошаговые', 'turn-based', 'Пошаговые стратегии', '550e8400-e29b-41d4-a716-446655440004'),
  ('550e8400-e29b-41d4-a716-446655440016', '4X', '4x', 'Глобальные стратегии', '550e8400-e29b-41d4-a716-446655440004');

-- Insert initial tags
INSERT INTO tags (id, name, slug) VALUES
  ('650e8400-e29b-41d4-a716-446655440001', 'Одиночная игра', 'singleplayer'),
  ('650e8400-e29b-41d4-a716-446655440002', 'Многопользовательская', 'multiplayer'),
  ('650e8400-e29b-41d4-a716-446655440003', 'Кооператив', 'coop'),
  ('650e8400-e29b-41d4-a716-446655440004', 'PvP', 'pvp'),
  ('650e8400-e29b-41d4-a716-446655440005', 'Открытый мир', 'open-world'),
  ('650e8400-e29b-41d4-a716-446655440006', 'Песочница', 'sandbox'),
  ('650e8400-e29b-41d4-a716-446655440007', 'Выживание', 'survival'),
  ('650e8400-e29b-41d4-a716-446655440008', 'Хоррор', 'horror'),
  ('650e8400-e29b-41d4-a716-446655440009', 'Фантастика', 'sci-fi'),
  ('650e8400-e29b-41d4-a716-446655440010', 'Фэнтези', 'fantasy'),
  ('650e8400-e29b-41d4-a716-446655440011', 'Постапокалипсис', 'post-apocalyptic'),
  ('650e8400-e29b-41d4-a716-446655440012', 'Стимпанк', 'steampunk'),
  ('650e8400-e29b-41d4-a716-446655440013', 'Киберпанк', 'cyberpunk'),
  ('650e8400-e29b-41d4-a716-446655440014', 'Ретро', 'retro'),
  ('650e8400-e29b-41d4-a716-446655440015', 'Пиксель-арт', 'pixel-art'),
  ('650e8400-e29b-41d4-a716-446655440016', 'Реализм', 'realistic'),
  ('650e8400-e29b-41d4-a716-446655440017', 'Мультяшный', 'cartoon'),
  ('650e8400-e29b-41d4-a716-446655440018', 'Минимализм', 'minimalist'),
  ('650e8400-e29b-41d4-a716-446655440019', 'Русская локализация', 'russian-localization'),
  ('650e8400-e29b-41d4-a716-446655440020', 'Русские субтитры', 'russian-subtitles');

-- Insert sample franchise
INSERT INTO franchises (id, name, description) VALUES
  ('750e8400-e29b-41d4-a716-446655440001', 'Metro', 'Серия игр по вселенной Метро 2033'),
  ('750e8400-e29b-41d4-a716-446655440002', 'S.T.A.L.K.E.R.', 'Серия игр в Зоне отчуждения'),
  ('750e8400-e29b-41d4-a716-446655440003', 'Pathologic', 'Серия психологических хорроров от Ice-Pick Lodge');

-- Insert sample bundle
INSERT INTO bundles (id, name, description, price) VALUES
  ('850e8400-e29b-41d4-a716-446655440001', 'Русские хиты', 'Лучшие игры российских разработчиков', 2999.99),
  ('850e8400-e29b-41d4-a716-446655440002', 'Инди-коллекция', 'Подборка независимых игр', 1499.99);

-- Create indexes for better performance on sample data queries
CREATE INDEX IF NOT EXISTS idx_categories_hierarchy ON categories (id, "parentId");
CREATE INDEX IF NOT EXISTS idx_tags_localization ON tags (slug) WHERE slug LIKE '%russian%';

-- Create a view for games with full information (useful for API queries)
CREATE OR REPLACE VIEW games_full_info AS
SELECT 
  g.*,
  array_agg(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL) as category_names,
  array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tag_names,
  f.name as franchise_name,
  COUNT(DISTINCT s.id) as screenshot_count,
  COUNT(DISTINCT v.id) as video_count,
  COUNT(DISTINCT d.id) as dlc_count,
  CASE 
    WHEN EXISTS (SELECT 1 FROM preorders p WHERE p."gameId" = g.id AND p."isAvailable" = true) 
    THEN true 
    ELSE false 
  END as has_preorder,
  CASE 
    WHEN EXISTS (SELECT 1 FROM demos dm WHERE dm."gameId" = g.id AND dm."isAvailable" = true) 
    THEN true 
    ELSE false 
  END as has_demo
FROM games g
LEFT JOIN game_categories gc ON g.id = gc.game_id
LEFT JOIN categories c ON gc.category_id = c.id
LEFT JOIN game_tags gt ON g.id = gt.game_id
LEFT JOIN tags t ON gt.tag_id = t.id
LEFT JOIN franchise_games fg ON g.id = fg.game_id
LEFT JOIN franchises f ON fg.franchise_id = f.id
LEFT JOIN game_screenshots s ON g.id = s."gameId"
LEFT JOIN game_videos v ON g.id = v."gameId"
LEFT JOIN dlcs d ON g.id = d."baseGameId"
GROUP BY g.id, f.name;

-- Create a function to get games by category hierarchy
CREATE OR REPLACE FUNCTION get_games_by_category_tree(category_slug VARCHAR)
RETURNS TABLE (
  game_id UUID,
  title VARCHAR,
  slug VARCHAR,
  price NUMERIC,
  status VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE category_tree AS (
    -- Base case: find the category by slug
    SELECT c.id, c.name, c.slug, c."parentId", 0 as level
    FROM categories c
    WHERE c.slug = category_slug
    
    UNION ALL
    
    -- Recursive case: find all child categories
    SELECT c.id, c.name, c.slug, c."parentId", ct.level + 1
    FROM categories c
    INNER JOIN category_tree ct ON c."parentId" = ct.id
  )
  SELECT DISTINCT g.id, g.title, g.slug, g.price, g.status
  FROM games g
  INNER JOIN game_categories gc ON g.id = gc.game_id
  INNER JOIN category_tree ct ON gc.category_id = ct.id
  WHERE g.status = 'published'
  ORDER BY g.title;
END;
$$ LANGUAGE plpgsql;

-- Create a function for full-text search with ranking
CREATE OR REPLACE FUNCTION search_games(search_query TEXT, limit_count INTEGER DEFAULT 20)
RETURNS TABLE (
  game_id UUID,
  title VARCHAR,
  slug VARCHAR,
  description TEXT,
  price NUMERIC,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.title,
    g.slug,
    g.description,
    g.price,
    ts_rank(g.search_vector, plainto_tsquery('russian_unaccent', search_query)) as rank
  FROM games g
  WHERE g.search_vector @@ plainto_tsquery('russian_unaccent', search_query)
    AND g.status = 'published'
  ORDER BY rank DESC, g.title
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to update category games count
CREATE OR REPLACE FUNCTION update_category_games_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update count for affected categories
  IF TG_OP = 'INSERT' THEN
    UPDATE categories 
    SET games_count = (
      SELECT COUNT(DISTINCT gc.game_id) 
      FROM game_categories gc 
      INNER JOIN games g ON gc.game_id = g.id 
      WHERE gc.category_id = NEW.category_id AND g.status = 'published'
    )
    WHERE id = NEW.category_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE categories 
    SET games_count = (
      SELECT COUNT(DISTINCT gc.game_id) 
      FROM game_categories gc 
      INNER JOIN games g ON gc.game_id = g.id 
      WHERE gc.category_id = OLD.category_id AND g.status = 'published'
    )
    WHERE id = OLD.category_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for category games count
DROP TRIGGER IF EXISTS trigger_update_category_games_count ON game_categories;
CREATE TRIGGER trigger_update_category_games_count
  AFTER INSERT OR DELETE ON game_categories
  FOR EACH ROW EXECUTE FUNCTION update_category_games_count();

-- Create a function to update tag games count
CREATE OR REPLACE FUNCTION update_tag_games_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update count for affected tags
  IF TG_OP = 'INSERT' THEN
    UPDATE tags 
    SET games_count = (
      SELECT COUNT(DISTINCT gt.game_id) 
      FROM game_tags gt 
      INNER JOIN games g ON gt.game_id = g.id 
      WHERE gt.tag_id = NEW.tag_id AND g.status = 'published'
    )
    WHERE id = NEW.tag_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tags 
    SET games_count = (
      SELECT COUNT(DISTINCT gt.game_id) 
      FROM game_tags gt 
      INNER JOIN games g ON gt.game_id = g.id 
      WHERE gt.tag_id = OLD.tag_id AND g.status = 'published'
    )
    WHERE id = OLD.tag_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tag games count
DROP TRIGGER IF EXISTS trigger_update_tag_games_count ON game_tags;
CREATE TRIGGER trigger_update_tag_games_count
  AFTER INSERT OR DELETE ON game_tags
  FOR EACH ROW EXECUTE FUNCTION update_tag_games_count();

-- Add missing columns to categories and tags tables for games count
ALTER TABLE categories ADD COLUMN IF NOT EXISTS games_count INTEGER DEFAULT 0;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS games_count INTEGER DEFAULT 0;

COMMIT;