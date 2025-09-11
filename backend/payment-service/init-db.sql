-- Initialize Payment Service Database
-- This script creates the basic database structure for development

-- Create database if it doesn't exist (for development)
-- Note: This will be handled by docker-compose environment variables

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types for better type safety
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('pending', 'paid', 'cancelled', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_provider AS ENUM ('sberbank', 'yandex', 'tbank');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for better performance (will be created by TypeORM migrations)
-- These are just placeholders for reference

-- Performance optimization indexes:
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_id ON orders(user_id);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status ON orders(status);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at ON orders(created_at);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_order_id ON payments(order_id);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_status ON payments(status);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_external_id ON payments(external_id);

-- Grant permissions (for development)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;