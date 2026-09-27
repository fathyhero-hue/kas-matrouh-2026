-- MANUAL ONLY. Run with psql -v ON_ERROR_STOP=1 in a disposable LOCAL database
-- named admin_management_test. NOT Supabase Production. No Auth users are created.
-- This is a minimal schema harness for the actual migration, not a migration.
do $$ begin
  if current_database() <> 'admin_management_test' then
    raise exception 'LOCAL_TEST_DATABASE_REQUIRED';
  end if;
end $$;
create role anon;
create role authenticated;
create role service_role;
create table public.admin_roles(key text primary key);
insert into public.admin_roles values ('super_admin'), ('viewer');
create table public.admin_permissions(key text primary key);
insert into public.admin_permissions values ('admins.view'),('admins.create'),('admins.edit'),
  ('admins.disable'),('admins.permissions.manage'),('admins.reset_password'),('matches.edit');
create table public.admin_profiles(
  user_id uuid primary key, display_name text, role_key text references public.admin_roles,
  is_active boolean not null, created_at timestamptz default now(), last_login_at timestamptz,
  updated_at timestamptz default now()
);
create table public.admin_permission_overrides(
  user_id uuid references public.admin_profiles, permission_key text references public.admin_permissions,
  effect text check(effect in ('allow','deny')), updated_at timestamptz default now(),
  primary key(user_id,permission_key)
);
create table public.admin_audit_logs(
  actor_user_id uuid, action text, permission_key text, entity_type text, entity_id text, metadata jsonb
);
insert into public.admin_profiles(user_id,display_name,role_key,is_active) values
 ('00000000-0000-4000-8000-000000000001','A','super_admin',true),
 ('00000000-0000-4000-8000-000000000002','B','super_admin',true);
\ir ../../supabase/migrations/20260927092548_admin_management_atomic.sql
grant usage on schema public to service_role;
grant select,insert,update,delete on all tables in schema public to service_role;
