-- Achievement Service Database Initialization Script

-- Create database if not exists (for development)
-- SELECT 'CREATE DATABASE achievement_db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'achievement_db')\gexec

-- Set timezone
SET timezone = 'UTC';

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create indexes for better performance
-- These will be created by TypeORM migrations, but we can prepare the database

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE achievement_db TO achievement_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO achievement_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO achievement_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO achievement_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO achievement_user;