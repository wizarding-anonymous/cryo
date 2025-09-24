-- Database initialization script for Library Service
-- This script sets up the database with proper extensions and configurations

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create indexes for better performance (will be created by TypeORM migrations)
-- This is just a placeholder for any manual database setup

-- Set up database configuration for optimal performance
-- Note: pg_stat_statements extension needs to be loaded at server start
-- These settings are handled in docker-compose command parameters

-- Create a read-only user for monitoring (optional)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'library_readonly') THEN
        CREATE ROLE library_readonly WITH LOGIN PASSWORD 'readonly_password';
        GRANT CONNECT ON DATABASE library_service TO library_readonly;
        GRANT USAGE ON SCHEMA public TO library_readonly;
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO library_readonly;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO library_readonly;
    END IF;
END
$$;

-- Log successful initialization
SELECT 'Library Service database initialized successfully' AS status;