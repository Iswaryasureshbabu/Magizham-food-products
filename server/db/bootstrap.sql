-- =============================================================
--  Magizham Food Products - PostgreSQL bootstrap
--
--  Creates the login role and the application database.
--  It is idempotent: running it again never drops a database,
--  a role or any data.
--
--  Usage (PowerShell):
--    $env:PGPASSWORD = "your-postgres-password"
--    psql -U postgres -d postgres `
--         -v app_password="YOUR_APP_ROLE_PASSWORD" `
--         -v app_db=magizham_db `
--         -v app_user=magizham_app `
--         -f server/db/bootstrap.sql
--
--  Usage (cmd.exe):
--    set PGPASSWORD=your-postgres-password
--    psql -U postgres -d postgres -v app_password=YOUR_APP_ROLE_PASSWORD -v app_db=magizham_db -v app_user=magizham_app -f server/db/bootstrap.sql
--
--  Afterwards put the same application role password into the project
--  .env file:
--
--    DATABASE_URL=postgresql://magizham_app:YOUR_APP_ROLE_PASSWORD@127.0.0.1:5432/magizham_db
--
--  The equivalent Node helper (npm run db:bootstrap) writes .env
--  automatically and is the recommended way.
-- =============================================================

\set ON_ERROR_STOP on

\echo '==> creating / refreshing the application role'

-- create the role when it does not exist yet
SELECT format('CREATE ROLE %I WITH LOGIN PASSWORD %L', :'app_user', :'app_password')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec

-- make sure the role exists with the requested password
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'app_user', :'app_password')
\gexec

\echo '==> creating the application database when it does not exist yet'

-- CREATE DATABASE cannot run inside a transaction block, \gexec runs it standalone
SELECT format('CREATE DATABASE %I OWNER %I ENCODING ''UTF8'' TEMPLATE template0',
              :'app_db', :'app_user')
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'app_db')
\gexec

\echo '==> granting the schema level privileges'

\connect :app_db

GRANT CONNECT ON DATABASE :"app_db" TO :"app_user";
GRANT USAGE, CREATE ON SCHEMA public TO :"app_user";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO :"app_user";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO :"app_user";

\echo '==> bootstrap finished - next steps:'
\echo '    npm run db:migrate'
\echo '    npm run db:seed'
\echo '    npm run admin:create'
\echo '    npm run server'
