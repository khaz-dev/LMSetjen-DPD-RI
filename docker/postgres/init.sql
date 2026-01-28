-- PostgreSQL Initialization Script
-- LMSetjen DPD RI - Learning Management System

-- Database is already created via POSTGRES_DB environment variable
-- User is already created via POSTGRES_USER environment variable

-- Enable required extensions on the database
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Set timezone
ALTER DATABASE lms_db SET timezone TO 'UTC';

-- Set the password for the user (ensure it matches DB_PASSWORD)
ALTER USER lms_user WITH PASSWORD 'secure_password';

-- Grant necessary permissions
ALTER DATABASE lms_db OWNER TO lms_user;
GRANT ALL PRIVILEGES ON DATABASE lms_db TO lms_user;
