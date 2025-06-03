-- Create database user and roles
-- This script runs when PostgreSQL container starts

-- Create the main application user
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'lap04') THEN
        CREATE USER lap04 WITH PASSWORD 'lap04pass';
    END IF;
END
$$;

-- Create root role if it doesn't exist (for CI/CD compatibility)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'root') THEN
        CREATE ROLE root WITH LOGIN PASSWORD 'rootpass';
    END IF;
END
$$;

-- Grant necessary privileges
ALTER USER lap04 CREATEDB;
ALTER ROLE root CREATEDB;

-- Note: CREATE DATABASE commands are handled separately in CI/CD
-- because they cannot run inside transaction blocks 