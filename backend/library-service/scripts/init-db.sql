-- Initialize database for development
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create development database if it doesn't exist
SELECT 'CREATE DATABASE library_service'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'library_service')\gexec