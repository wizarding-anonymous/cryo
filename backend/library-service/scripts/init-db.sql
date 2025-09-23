-- Initialize Library Service Database

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create indexes for better performance (will be created by TypeORM migrations in production)
-- This is just for development setup

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE library_service TO postgres;

-- Create test database for integration tests
SELECT 'CREATE DATABASE library_service_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'library_service_test')\gexec

GRANT ALL PRIVILEGES ON DATABASE library_service_test TO postgres;