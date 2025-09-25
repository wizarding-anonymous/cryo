-- Initialize database for review service
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create indexes for better performance
-- These will be created by TypeORM migrations, but having them here ensures they exist