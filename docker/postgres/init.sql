-- PostgreSQL Initialization Script
-- LMSetjen DPD RI - Learning Management System

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create database if it doesn't exist (handled by POSTGRES_DB env var)
-- This script runs after database creation

-- Set timezone
ALTER DATABASE django_lms_db SET timezone TO 'UTC';

-- Create indexes for better performance (will be created by Django migrations)
-- This is just a placeholder for any custom initialization

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE django_lms_db TO lms_user;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE '✅ PostgreSQL database initialized successfully';
END $$;
