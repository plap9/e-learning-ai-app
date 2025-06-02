-- Create database user and roles
-- This script runs when PostgreSQL container starts

-- Create the main application user
CREATE USER lap04 WITH PASSWORD 'lap04pass';

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

-- Create the main database
CREATE DATABASE mydb OWNER lap04;

-- Grant all privileges on the database
GRANT ALL PRIVILEGES ON DATABASE mydb TO lap04;
GRANT ALL PRIVILEGES ON DATABASE mydb TO root;

-- Create test database
CREATE DATABASE mydb_test OWNER lap04;
GRANT ALL PRIVILEGES ON DATABASE mydb_test TO lap04;
GRANT ALL PRIVILEGES ON DATABASE mydb_test TO root; 