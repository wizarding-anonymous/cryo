-- Initialize Review Service Database
-- This script runs when PostgreSQL container starts for the first time

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create indexes for better performance (will be managed by TypeORM migrations)
-- These are just initial setup, actual schema will be created by TypeORM

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE review_db TO review_user;