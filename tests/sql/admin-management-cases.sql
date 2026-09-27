\set ON_ERROR_STOP on
do $$ begin
  if current_database() <> 'admin_management_test' then raise exception 'LOCAL_TEST_DATABASE_REQUIRED'; end if;
end $$;
begin;
set local role service_role;
-- Two active super admins: A may disable/re-enable/demote B.
select public.admin_management_mutate('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','{"is_active":false}');
select public.admin_management_mutate('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','{"is_active":true}');
select public.admin_management_mutate('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','{"role_key":"viewer"}');
select public.admin_management_mutate('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','{"role_key":"super_admin"}');
-- Explicit effects and INHERIT remove exactly one override.
select public.admin_management_mutate('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','{}','matches.edit','allow');
select public.admin_management_mutate('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','{}','matches.edit','deny');
select public.admin_management_mutate('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','{}','matches.edit','inherit');
do $$ begin
  if exists(select 1 from public.admin_permission_overrides) then raise exception 'INHERIT_FAILED'; end if;
  begin
    perform public.admin_management_mutate('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','{"is_active":false}');
    raise exception 'SELF_DISABLE_NOT_BLOCKED';
  exception when check_violation then null; end;
  begin
    perform public.admin_management_mutate('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','{"role_key":"viewer"}');
    raise exception 'SELF_DEMOTE_NOT_BLOCKED';
  exception when check_violation then null; end;
end $$;
-- Make A incapable of viewing admins but retain its edit/disable permission.
-- B is now the LAST capable super admin. A cannot remove B by ANY of these paths.
select public.admin_management_mutate('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','{}','admins.view','deny');
do $$
declare change jsonb;
begin
  foreach change in array array['{"is_active":false}'::jsonb,'{"role_key":"viewer"}'::jsonb] loop
    begin
      perform public.admin_management_mutate('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',change);
      raise exception 'LAST_SUPER_NOT_BLOCKED';
    exception when check_violation then null; end;
  end loop;
  begin
    perform public.admin_management_mutate('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','{}','admins.view','deny');
    raise exception 'LAST_OVERRIDE_NOT_BLOCKED';
  exception when check_violation then null; end;
  if not exists(select 1 from public.admin_profiles where user_id='00000000-0000-4000-8000-000000000002' and is_active and role_key='super_admin') then
    raise exception 'ROLLBACK_FAILED';
  end if;
end $$;
rollback;
