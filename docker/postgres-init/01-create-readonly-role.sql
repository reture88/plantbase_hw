-- Read-only DB role for the agent's runSql tool (NFR1: agent never writes).
-- Runs only on first container init (empty data volume), before Prisma's
-- migration creates the `products` table.
CREATE ROLE plantbase_ro LOGIN PASSWORD 'plantbase_ro';
GRANT CONNECT ON DATABASE plantbase TO plantbase_ro;
GRANT USAGE ON SCHEMA public TO plantbase_ro;

-- Applies to tables created LATER by the plantbase (read-write) role,
-- so `products` is automatically SELECT-able after the migration runs,
-- with no separate grant step needed.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO plantbase_ro;

-- Defense in depth: reject writes and cap runaway queries at the DB level,
-- independent of the application-level SQL guard.
ALTER ROLE plantbase_ro SET default_transaction_read_only = on;
ALTER ROLE plantbase_ro SET statement_timeout = '5s';
