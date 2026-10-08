-- Manual Supabase SQL Editor wrapper for 20261008220000_card_events.sql.
-- The migration body below is copied without semantic changes.
begin;

-- Per-match card events. Legacy public.cards totals remain untouched and are
-- intentionally excluded from automatic suspension calculations.
create table if not exists public.card_events (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references public.brackets(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete restrict,
  roster_player_id uuid not null references public.roster_players(id) on delete restrict,
  team_roster_id uuid not null references public.team_rosters(id) on delete restrict,
  card_type text not null check (card_type in ('yellow', 'direct_red')),
  idempotency_key uuid,
  source_card_id uuid references public.cards(id) on delete restrict,
  source_card_ordinal smallint,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint card_events_source_ordinal_check check (source_card_id is null or source_card_ordinal is not null and source_card_ordinal > 0),
  constraint card_events_new_event_idempotency_check check ((source_card_id is null) = (idempotency_key is not null))
);

create table if not exists public.card_event_idempotency (
  idempotency_key uuid primary key,
  card_event_id uuid references public.card_events(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists card_events_bracket_match_idx on public.card_events(bracket_id, match_id);
create index if not exists card_events_player_created_idx on public.card_events(roster_player_id, created_at, id);
create index if not exists card_events_team_match_idx on public.card_events(team_roster_id, match_id);
create unique index if not exists card_events_source_ordinal_uidx on public.card_events(source_card_id, source_card_ordinal) where source_card_id is not null;
create unique index if not exists card_events_idempotency_uidx on public.card_events(idempotency_key) where idempotency_key is not null;

alter table public.card_events enable row level security;
alter table public.card_events force row level security;
revoke all on table public.card_events from public, anon, authenticated;
grant all on table public.card_events to service_role;
alter table public.card_event_idempotency enable row level security;
alter table public.card_event_idempotency force row level security;
revoke all on table public.card_event_idempotency from public, anon, authenticated;
grant all on table public.card_event_idempotency to service_role;

create or replace function public.prevent_historical_card_event_delete()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.source_card_id is not null then
    raise exception 'HISTORICAL_CARD_EVENT_IMMUTABLE';
  end if;
  return old;
end;
$$;

drop trigger if exists card_events_protect_historical_delete on public.card_events;
create trigger card_events_protect_historical_delete
before delete on public.card_events
for each row execute function public.prevent_historical_card_event_delete();

revoke all on function public.prevent_historical_card_event_delete() from public, anon, authenticated;
grant execute on function public.prevent_historical_card_event_delete() to service_role;

create or replace function public.distribute_card_events(p_source_card_id uuid, p_events jsonb, p_actor uuid)
returns setof public.card_events
language plpgsql
security definer
set search_path = public
as $$
declare
  source_row public.cards%rowtype;
  item jsonb;
  ordinal smallint;
  match_id_value uuid;
  player_id_value uuid;
  team_id_value uuid;
  card_type_value text;
  source_team text;
  existing_row public.card_events%rowtype;
  yellow_total integer := 0;
  red_total integer := 0;
begin
  if p_actor is null or not exists (select 1 from auth.users where id = p_actor) then
    raise exception 'ACTOR_REQUIRED';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_source_card_id::text, 0));
  select * into source_row from public.cards where id = p_source_card_id for update;
  if not found then raise exception 'SOURCE_CARD_NOT_FOUND'; end if;
  if source_row.roster_player_id is null or source_row.team_roster_id is null then raise exception 'SOURCE_CARD_IDENTITY_REQUIRED'; end if;
  select team_name into source_team from public.team_rosters where id = source_row.team_roster_id and bracket_id = source_row.bracket_id;
  if source_team is null then raise exception 'SOURCE_CARD_TEAM_NOT_FOUND'; end if;
  if jsonb_typeof(p_events) <> 'array' then raise exception 'EVENTS_ARRAY_REQUIRED'; end if;

  for item in select value from jsonb_array_elements(p_events)
  loop
    ordinal := (item->>'ordinal')::smallint;
    match_id_value := (item->>'match_id')::uuid;
    card_type_value := item->>'card_type';
    if ordinal is null or ordinal < 1 or ordinal > coalesce(source_row.yellow, 0) + coalesce(source_row.red, 0) or match_id_value is null or card_type_value not in ('yellow', 'direct_red') then raise exception 'INVALID_EVENT'; end if;
    select * into existing_row from public.card_events where source_card_id = p_source_card_id and source_card_ordinal = ordinal;
    if found then
      if existing_row.match_id <> match_id_value or existing_row.card_type <> card_type_value then raise exception 'EVENT_ALREADY_ASSIGNED_DIFFERENTLY'; end if;
      continue;
    end if;
    if card_type_value = 'yellow' then yellow_total := yellow_total + 1; else red_total := red_total + 1; end if;
    player_id_value := source_row.roster_player_id;
    team_id_value := source_row.team_roster_id;
    if not exists (select 1 from public.matches m where m.id = match_id_value and m.bracket_id = source_row.bracket_id and (m.team_a = source_team or m.team_b = source_team)) then raise exception 'MATCH_TEAM_MISMATCH'; end if;
    if not exists (select 1 from public.roster_players p where p.id = player_id_value and p.roster_id = team_id_value) then raise exception 'PLAYER_TEAM_MISMATCH'; end if;
    insert into public.card_events (bracket_id, match_id, roster_player_id, team_roster_id, card_type, source_card_id, source_card_ordinal, created_by)
      values (source_row.bracket_id, match_id_value, player_id_value, team_id_value, card_type_value, p_source_card_id, ordinal, p_actor);
  end loop;
  select count(*) filter (where card_type = 'yellow'), count(*) filter (where card_type = 'direct_red')
    into yellow_total, red_total from public.card_events where source_card_id = p_source_card_id;
  if yellow_total > coalesce(source_row.yellow, 0) or red_total > coalesce(source_row.red, 0) then raise exception 'EVENT_TOTAL_EXCEEDS_LEGACY_TOTAL'; end if;
  return query select * from public.card_events where source_card_id = p_source_card_id order by source_card_ordinal;
end;
$$;

revoke all on function public.distribute_card_events(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.distribute_card_events(uuid, jsonb, uuid) to service_role;

create or replace function public.create_card_event(
  p_bracket_id uuid,
  p_match_id uuid,
  p_roster_player_id uuid,
  p_team_roster_id uuid,
  p_card_type text,
  p_idempotency_key uuid,
  p_actor uuid
)
returns public.card_events
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_row public.card_events%rowtype;
  idempotency_row public.card_event_idempotency%rowtype;
  team_name_value text;
  new_row public.card_events%rowtype;
begin
  if p_actor is null or not exists (select 1 from auth.users where id = p_actor) then
    raise exception 'ACTOR_REQUIRED';
  end if;
  if p_idempotency_key is null or p_card_type not in ('yellow', 'direct_red') then
    raise exception 'INVALID_EVENT';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 1));
  select * into idempotency_row from public.card_event_idempotency where idempotency_key = p_idempotency_key for update;
  if found then
    if idempotency_row.card_event_id is null then raise exception 'IDEMPOTENCY_EVENT_ALREADY_DELETED'; end if;
    select * into existing_row from public.card_events where id = idempotency_row.card_event_id;
    if not found then raise exception 'IDEMPOTENCY_EVENT_ALREADY_DELETED'; end if;
    if existing_row.bracket_id is distinct from p_bracket_id
      or existing_row.match_id is distinct from p_match_id
      or existing_row.roster_player_id is distinct from p_roster_player_id
      or existing_row.team_roster_id is distinct from p_team_roster_id
      or existing_row.card_type is distinct from p_card_type then
      raise exception 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH';
    end if;
    return existing_row;
  end if;

  select team_name into team_name_value from public.team_rosters where id = p_team_roster_id and bracket_id = p_bracket_id;
  if team_name_value is null then raise exception 'TEAM_BRACKET_MISMATCH'; end if;
  if not exists (select 1 from public.roster_players where id = p_roster_player_id and roster_id = p_team_roster_id) then
    raise exception 'PLAYER_TEAM_MISMATCH';
  end if;
  if not exists (select 1 from public.matches where id = p_match_id and bracket_id = p_bracket_id and (team_a = team_name_value or team_b = team_name_value)) then
    raise exception 'MATCH_TEAM_MISMATCH';
  end if;

  insert into public.card_events (bracket_id, match_id, roster_player_id, team_roster_id, card_type, idempotency_key, created_by)
  values (p_bracket_id, p_match_id, p_roster_player_id, p_team_roster_id, p_card_type, p_idempotency_key, p_actor)
  returning * into new_row;
  insert into public.card_event_idempotency (idempotency_key, card_event_id)
  values (p_idempotency_key, new_row.id);
  return new_row;
end;
$$;

revoke all on function public.create_card_event(uuid, uuid, uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_card_event(uuid, uuid, uuid, uuid, text, uuid, uuid) to service_role;

commit;
