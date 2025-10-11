-- Auth Service Database Initialization Script
-- This script sets up the initial database configuration for Docker environment

-- Create extensions if they don't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set timezone
SET timezone = 'UTC';

-- Basic performance settings (Docker environment)
-- Note: Some settings may require container restart

-- Create a function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE auth_db TO auth_service;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO auth_service;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO auth_service;

-- Create schema for migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS auth_migrations (
    id SERIAL PRIMARY KEY,
    timestamp BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL
);

-- Insert initial setup log
INSERT INTO auth_migrations (timestamp, name) 
VALUES (EXTRACT(EPOCH FROM NOW()) * 1000, 'InitialDatabaseSetup')
ON CONFLICT DO NOTHING;