-- READ ONLY. Run in the warehouse project's SQL Editor before the migration.
-- Save this schema report with the deployment record, not in the public repo.
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('sections','boxes','items','lendings')
ORDER BY table_name, ordinal_position;

SELECT c.relname AS table_name, con.conname, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('sections','boxes','items','lendings');

SELECT c.relname AS table_name, t.tgname, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('sections','boxes','items','lendings') AND NOT t.tgisinternal;

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname='public'
AND tablename IN ('sections','boxes','items','lendings');

SELECT table_name, grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema='public' AND table_name IN ('sections','boxes','items','lendings')
AND grantee IN ('anon','authenticated','service_role')
ORDER BY table_name, grantee, privilege_type;
