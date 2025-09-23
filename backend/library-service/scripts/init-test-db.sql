-- Initialize database for testing
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create test database if it doesn't exist
SELECT 'CREATE DATABASE library_service_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'library_service_test')\gexec