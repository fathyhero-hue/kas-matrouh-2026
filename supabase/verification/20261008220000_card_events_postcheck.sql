-- Read-only post-migration verification for project kfhoibszyssvazwwhcaa.
-- Run with a read-only database role. This script performs no writes.

select current_database() as database_name, current_user as executing_role;

select table_schema, table_name
from information_schema.tables
where table_schema = 'public' and table_name in ('card_events', 'card_event_idempotency')
order by table_name;

select table_name, column_name, data_type, udt_name, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name in ('card_events', 'card_event_idempotency')
order by table_name, ordinal_position;

select tc.table_name, tc.constraint_name, tc.constraint_type,
       kcu.column_name, ccu.table_name as referenced_table, ccu.column_name as referenced_column,
       rc.delete_rule
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on kcu.constraint_schema = tc.constraint_schema and kcu.constraint_name = tc.constraint_name
left join information_schema.constraint_column_usage ccu
  on ccu.constraint_schema = tc.constraint_schema and ccu.constraint_name = tc.constraint_name
left join information_schema.referential_constraints rc
  on rc.constraint_schema = tc.constraint_schema and rc.constraint_name = tc.constraint_name
where tc.constraint_schema = 'public' and tc.table_name in ('card_events', 'card_event_idempotency')
order by tc.table_name, tc.constraint_name, kcu.ordinal_position;

select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename in ('card_events', 'card_event_idempotency')
order by tablename, indexname;

select n.nspname as schema_name, c.relname as object_name,
       c.relkind, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('card_events', 'card_event_idempotency');

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('card_events', 'card_event_idempotency');

select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('card_events', 'card_event_idempotency')
  and grantee in ('public', 'anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

select has_table_privilege('anon', 'public.card_events', 'SELECT,INSERT,UPDATE,DELETE') as anon_base_table_write_or_read,
       has_table_privilege('authenticated', 'public.card_events', 'SELECT,INSERT,UPDATE,DELETE') as authenticated_base_table_write_or_read,
       has_table_privilege('service_role', 'public.card_events', 'SELECT,INSERT,UPDATE,DELETE') as service_role_full_access;

select routine_schema, routine_name, routine_type, security_type, data_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('create_card_event', 'distribute_card_events', 'prevent_historical_card_event_delete');

select routine_schema, routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('create_card_event', 'distribute_card_events', 'prevent_historical_card_event_delete')
order by routine_name, grantee, privilege_type;

select p.proname as routine_name,
       has_function_privilege('public', p.oid, 'EXECUTE') as public_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_card_event', 'distribute_card_events', 'prevent_historical_card_event_delete');

select event_object_schema, event_object_table, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers
where event_object_schema = 'public' and event_object_table in ('card_events', 'card_event_idempotency');

-- Historical cards must be unchanged. Capture before migration and compare after migration.
-- Replace the placeholders with values recorded before application; do not use this query to mutate data.
select count(*) as cards_row_count,
       coalesce(sum(yellow), 0) as cards_yellow_total,
       coalesce(sum(red), 0) as cards_red_total,
       md5(string_agg(concat_ws('|', id, bracket_id, roster_player_id, team_roster_id, match_id, yellow, red), E'\n' order by id)) as cards_fingerprint
from public.cards;

-- This produces the post-migration fingerprint only. Compare it with the pre-migration
-- fingerprint captured before application; SQL cannot reconstruct a missing baseline.
