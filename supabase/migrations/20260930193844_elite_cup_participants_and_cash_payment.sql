-- Local review artifact for Elite Cup participant and cash-payment semantics.
-- Do not apply to Production until the affected legacy rows are reviewed.

alter table public.orders
  add column if not exists confirmed_by uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_confirmed_by_fkey'
  ) then
    alter table public.orders
      add constraint orders_confirmed_by_fkey
      foreign key (confirmed_by) references auth.users(id) on delete set null;
  end if;
end
$$;

create index if not exists orders_confirmed_by_idx on public.orders(confirmed_by);

create unique index if not exists elite_teams_name_unique_idx on public.elite_teams(name);

insert into public.elite_teams (legacy_id, name)
select seed.legacy_id, seed.name
from (
  values
    ('elite-cup-001', 'غوط رباح'),
    ('elite-cup-002', 'وادي ماجد'),
    ('elite-cup-003', 'القدس'),
    ('elite-cup-004', 'أبناء باسط'),
    ('elite-cup-005', 'الوادي'),
    ('elite-cup-006', 'المثاني'),
    ('elite-cup-007', 'أم القبائل'),
    ('elite-cup-008', 'براني'),
    ('elite-cup-009', 'النسور')
) as seed(legacy_id, name)
where not exists (
  select 1
  from public.elite_teams existing
  where existing.name = seed.name or existing.legacy_id = seed.legacy_id
);

do $$
declare
  official_count integer;
  legacy_count integer;
  total_count integer;
begin
  select count(*) into official_count
  from public.elite_teams
  where name in ('غوط رباح', 'وادي ماجد', 'القدس', 'أبناء باسط', 'الوادي', 'المثاني', 'أم القبائل', 'براني', 'النسور');

  select count(*) into legacy_count
  from public.elite_teams
  where name = 'أصدقاء حاتم';

  select count(*) into total_count
  from public.elite_teams;

  if official_count <> 9 then
    raise exception 'Elite participant seed validation failed: expected 9 official teams, found %', official_count;
  end if;

  if legacy_count <> 0 then
    raise exception 'Elite participant seed validation failed: legacy team must not be seeded';
  end if;

  if total_count <> 9 then
    raise exception 'Elite participant seed validation failed: elite_teams must contain exactly the 9 official teams, found %', total_count;
  end if;
end
$$;
