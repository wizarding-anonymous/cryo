-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types for security service
DO $$ BEGIN
  CREATE TYPE security_events_type_enum AS ENUM ('LOGIN','TRANSACTION','SUSPICIOUS_ACTIVITY','IP_BLOCK','ACCOUNT_LOCK','PASSWORD_RESET','OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE security_alerts_type_enum AS ENUM ('SUSPICIOUS_ACTIVITY','MULTIPLE_FAILED_LOGINS','POSSIBLE_FRAUD','IP_BLOCKED','OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE security_alerts_severity_enum AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

