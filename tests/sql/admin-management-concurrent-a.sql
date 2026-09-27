\set ON_ERROR_STOP on
do $$ begin
  if current_database() <> 'admin_management_test' then raise exception 'LOCAL_TEST_DATABASE_REQUIRED'; end if;
end $$;
begin;
set local role service_role;
select public.admin_management_mutate('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','{"is_active":false}');
-- Start session B during this pause: it must wait on the transaction advisory lock.
select pg_sleep(10);
commit;
