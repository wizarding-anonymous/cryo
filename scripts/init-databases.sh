#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create additional databases for other microservices
    CREATE DATABASE game_catalog;
    CREATE DATABASE payment_service;
    CREATE DATABASE library_service;
    CREATE DATABASE social_service;
    CREATE DATABASE notification_service;
    CREATE DATABASE analytics_service;
    
    -- Grant privileges
    GRANT ALL PRIVILEGES ON DATABASE game_catalog TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE payment_service TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE library_service TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE social_service TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE notification_service TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE analytics_service TO $POSTGRES_USER;
EOSQL