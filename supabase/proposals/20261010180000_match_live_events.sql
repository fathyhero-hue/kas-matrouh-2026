-- Proposal only: review and move to migrations only after approval.
-- Existing match scores, goals, and card rows are deliberately not backfilled.

alter table public.matches
  add column if not exists live_events_enabled boolean not null default false,
  add column if not exists live_event_base_home_goals integer,
  add column if not exists live_event_base_away_goals integer,
  add column if not exists live_events_enabled_at timestamptz,
  add column if not exists live_events_enabled_by uuid references auth.users(id) on delete set null,
  add column if not exists venue text;

alter table public.matches
  add constraint matches_live_event_baseline_check
  check (
    (live_event_base_home_goals is null and live_event_base_away_goals is null)
    or
    (
      live_event_base_home_goals is not null
      and live_event_base_away_goals is not null
      and live_event_base_home_goals >= 0
      and live_event_base_away_goals >= 0
    )
  );

alter table public.card_events
  add column if not exists match_minute smallint;

alter table public.card_events
  add constraint card_events_match_minute_check
  check (match_minute is null or match_minute between 1 and 150);

alter table public.card_events
  drop constraint if exists card_events_card_type_check;
alter table public.card_events
  add constraint card_events_card_type_check
  check (card_type in ('yellow', 'direct_red', 'second_yellow_red'));

insert into public.admin_permissions (key, name, description)
values (
  'matches.live.correct_score',
  'Correct live match score baseline',
  'Correct the official score baseline for a match with live events enabled.'
)
on conflict (key) do nothing;

insert into public.admin_role_permissions (role_key, permission_key)
select 'super_admin', 'matches.live.correct_score'
where exists (select 1 from public.admin_roles where key = 'super_admin')
on conflict do nothing;

create table if not exists public.match_goal_events (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references public.brackets(id) on delete restrict,
  match_id uuid not null references public.matches(id) on delete restrict,
  team_roster_id uuid not null references public.team_rosters(id) on delete restrict,
  roster_player_id uuid not null references public.roster_players(id) on delete restrict,
  event_type text not null default 'goal' check (event_type = 'goal'),
  match_minute smallint not null check (match_minute between 1 and 150),
  idempotency_key uuid not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz
);

create index if not exists match_goal_events_match_active_idx
  on public.match_goal_events(match_id, team_roster_id)
  where revoked_at is null;
create index if not exists match_goal_events_scorer_active_idx
  on public.match_goal_events(bracket_id, roster_player_id)
  where revoked_at is null;

alter table public.match_goal_events enable row level security;
alter table public.match_goal_events force row level security;
revoke all on table public.match_goal_events from public, anon, authenticated;
revoke all on table public.match_goal_events from service_role;
grant select on table public.match_goal_events to service_role;

create schema if not exists live_events_private;
revoke all on schema live_events_private from public, anon, authenticated, service_role;

create table live_events_private.match_score_update_authorizations (
  backend_pid integer not null,
  transaction_id xid8 not null,
  match_id uuid not null references public.matches(id) on delete cascade,
  operation text not null check (operation in ('enable', 'score_event', 'correct_score')),
  primary key (backend_pid, transaction_id, match_id)
);
revoke all on table live_events_private.match_score_update_authorizations from public, anon, authenticated, service_role;

create table live_events_private.match_score_corrections (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches(id) on delete restrict,
  actor_user_id uuid not null,
  reason text not null,
  old_base_home_goals integer not null,
  old_base_away_goals integer not null,
  new_base_home_goals integer not null,
  new_base_away_goals integer not null,
  old_home_goals integer not null,
  old_away_goals integer not null,
  new_home_goals integer not null,
  new_away_goals integer not null,
  created_at timestamptz not null default now(),
  constraint match_score_corrections_reason_check check (length(btrim(reason)) between 1 and 1000),
  constraint match_score_corrections_scores_check check (
    old_base_home_goals >= 0 and old_base_away_goals >= 0
    and new_base_home_goals >= 0 and new_base_away_goals >= 0
    and old_home_goals >= 0 and old_away_goals >= 0
    and new_home_goals >= 0 and new_away_goals >= 0
  )
);
alter table live_events_private.match_score_corrections enable row level security;
revoke all on table live_events_private.match_score_corrections from public, anon, authenticated, service_role;

create or replace function live_events_private.prevent_score_correction_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'MATCH_SCORE_CORRECTION_AUDIT_IMMUTABLE';
end;
$$;

create trigger match_score_corrections_immutable
before update or delete on live_events_private.match_score_corrections
for each row execute function live_events_private.prevent_score_correction_audit_mutation();
revoke all on function live_events_private.prevent_score_correction_audit_mutation() from public, anon, authenticated, service_role;

create or replace function public.guard_match_live_event_scores()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  expected_operation text;
  score_update_authorized boolean;
begin
  if old.live_events_enabled is distinct from new.live_events_enabled then
    if old.live_events_enabled or new.live_events_enabled is distinct from true then
      raise exception 'LIVE_EVENTS_CANNOT_BE_DISABLED';
    end if;
    expected_operation := 'enable';
  elsif not old.live_events_enabled and (
    new.live_event_base_home_goals is distinct from old.live_event_base_home_goals
    or new.live_event_base_away_goals is distinct from old.live_event_base_away_goals
  ) then
    raise exception 'LIVE_EVENT_BASELINE_IMMUTABLE';
  elsif old.live_events_enabled and (
    new.live_event_base_home_goals is distinct from old.live_event_base_home_goals
    or new.live_event_base_away_goals is distinct from old.live_event_base_away_goals
  ) then
    expected_operation := 'correct_score';
  elsif old.live_events_enabled and (
    new.home_goals is distinct from old.home_goals
    or new.away_goals is distinct from old.away_goals
  ) then
    expected_operation := 'score_event';
  end if;

  if expected_operation is not null then
    delete from live_events_private.match_score_update_authorizations
    where backend_pid = pg_backend_pid()
      and transaction_id = pg_current_xact_id()
      and match_id = old.id
      and (
        operation = expected_operation
        or (expected_operation = 'score_event' and operation = 'correct_score')
      )
    returning true into score_update_authorized;
    if not coalesce(score_update_authorized, false) then
      if expected_operation = 'enable' then
        raise exception 'LIVE_EVENT_ENABLE_REQUIRES_RPC';
      elsif expected_operation = 'correct_score' then
        raise exception 'LIVE_SCORE_CORRECTION_REQUIRES_RPC';
      else
        raise exception 'MATCH_SCORE_CONTROLLED_BY_LIVE_EVENTS';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists matches_guard_live_event_scores on public.matches;
create trigger matches_guard_live_event_scores
before update of home_goals, away_goals, live_events_enabled,
  live_event_base_home_goals, live_event_base_away_goals
on public.matches
for each row execute function public.guard_match_live_event_scores();

revoke all on function public.guard_match_live_event_scores() from public, anon, authenticated;

create or replace function public.enable_match_live_events(p_match_id uuid, p_actor uuid)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  match_row public.matches%rowtype;
begin
  if p_actor is null or not exists (select 1 from auth.users where id = p_actor) then
    raise exception 'ACTOR_REQUIRED';
  end if;

  select * into match_row
  from public.matches
  where id = p_match_id
  for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  if match_row.status in ('انتهت', 'ملغاة', 'تأجلت') then
    raise exception 'MATCH_NOT_ELIGIBLE';
  end if;
  if match_row.team_a is not distinct from match_row.team_b then
    raise exception 'MATCH_TEAMS_AMBIGUOUS';
  end if;
  if coalesce(match_row.home_goals, 0) < 0 or coalesce(match_row.away_goals, 0) < 0 then
    raise exception 'INVALID_SCORE_BASELINE';
  end if;
  if match_row.live_events_enabled then return match_row; end if;

  insert into live_events_private.match_score_update_authorizations (backend_pid, transaction_id, match_id, operation)
  values (pg_backend_pid(), pg_current_xact_id(), p_match_id, 'enable')
  on conflict do nothing;
  update public.matches
  set live_events_enabled = true,
      live_event_base_home_goals = coalesce(home_goals, 0),
      live_event_base_away_goals = coalesce(away_goals, 0),
      live_events_enabled_at = now(),
      live_events_enabled_by = p_actor
  where id = p_match_id
  returning * into match_row;
  return match_row;
end;
$$;

create or replace function public.create_match_goal_event(
  p_bracket_id uuid,
  p_match_id uuid,
  p_team_roster_id uuid,
  p_roster_player_id uuid,
  p_match_minute smallint,
  p_idempotency_key uuid,
  p_actor uuid
)
returns public.match_goal_events
language plpgsql
security definer
set search_path = public
as $$
declare
  match_row public.matches%rowtype;
  team_row public.team_rosters%rowtype;
  existing_event public.match_goal_events%rowtype;
  new_event public.match_goal_events%rowtype;
  home_event_count integer;
  away_event_count integer;
begin
  if p_actor is null or not exists (select 1 from auth.users where id = p_actor) then
    raise exception 'ACTOR_REQUIRED';
  end if;
  if p_idempotency_key is null or p_match_minute is null or p_match_minute not between 1 and 150 then
    raise exception 'INVALID_EVENT';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 2));
  select * into existing_event
  from public.match_goal_events
  where idempotency_key = p_idempotency_key;
  if found then
    if existing_event.bracket_id is distinct from p_bracket_id
      or existing_event.match_id is distinct from p_match_id
      or existing_event.team_roster_id is distinct from p_team_roster_id
      or existing_event.roster_player_id is distinct from p_roster_player_id
      or existing_event.match_minute is distinct from p_match_minute then
      raise exception 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH';
    end if;
    if existing_event.revoked_at is not null then
      raise exception 'IDEMPOTENCY_EVENT_ALREADY_REVOKED';
    end if;
    return existing_event;
  end if;

  select * into match_row from public.matches where id = p_match_id for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  if match_row.bracket_id is distinct from p_bracket_id then raise exception 'MATCH_BRACKET_MISMATCH'; end if;
  if not match_row.live_events_enabled
    or match_row.live_event_base_home_goals is null
    or match_row.live_event_base_away_goals is null then
    raise exception 'LIVE_EVENTS_NOT_ENABLED';
  end if;
  if match_row.is_live is distinct from true
    or match_row.status is null
    or match_row.status not in ('الشوط الأول', 'استراحة', 'الشوط الثاني', 'ضربات جزاء') then
    raise exception 'MATCH_NOT_LIVE';
  end if;

  select * into team_row
  from public.team_rosters
  where id = p_team_roster_id and bracket_id = p_bracket_id;
  if not found then raise exception 'TEAM_BRACKET_MISMATCH'; end if;
  if team_row.team_name is null or (team_row.team_name <> match_row.team_a and team_row.team_name <> match_row.team_b) then
    raise exception 'TEAM_NOT_IN_MATCH';
  end if;
  if not exists (
    select 1 from public.roster_players
    where id = p_roster_player_id and roster_id = p_team_roster_id
  ) then raise exception 'PLAYER_TEAM_MISMATCH'; end if;

  insert into public.match_goal_events (
    bracket_id, match_id, team_roster_id, roster_player_id,
    match_minute, idempotency_key, created_by
  ) values (
    p_bracket_id, p_match_id, p_team_roster_id, p_roster_player_id,
    p_match_minute, p_idempotency_key, p_actor
  ) returning * into new_event;

  select
    count(*) filter (where tr.team_name = match_row.team_a),
    count(*) filter (where tr.team_name = match_row.team_b)
  into home_event_count, away_event_count
  from public.match_goal_events e
  join public.team_rosters tr on tr.id = e.team_roster_id
  where e.match_id = p_match_id and e.revoked_at is null;

  insert into live_events_private.match_score_update_authorizations (backend_pid, transaction_id, match_id, operation)
  values (pg_backend_pid(), pg_current_xact_id(), p_match_id, 'score_event')
  on conflict do nothing;
  update public.matches
  set home_goals = live_event_base_home_goals + home_event_count,
      away_goals = live_event_base_away_goals + away_event_count
  where id = p_match_id;
  return new_event;
end;
$$;

create or replace function public.revoke_match_goal_event(p_event_id uuid, p_actor uuid)
returns public.match_goal_events
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.match_goal_events%rowtype;
  match_row public.matches%rowtype;
  home_event_count integer;
  away_event_count integer;
begin
  if p_actor is null or not exists (select 1 from auth.users where id = p_actor) then
    raise exception 'ACTOR_REQUIRED';
  end if;

  select m.* into match_row
  from public.matches m
  join public.match_goal_events e on e.match_id = m.id
  where e.id = p_event_id
  for update of m;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;

  select * into event_row
  from public.match_goal_events
  where id = p_event_id
  for update;
  if event_row.revoked_at is not null then return event_row; end if;

  update public.match_goal_events
  set revoked_by = p_actor, revoked_at = now(), updated_by = p_actor, updated_at = now()
  where id = p_event_id
  returning * into event_row;

  select
    count(*) filter (where tr.team_name = match_row.team_a),
    count(*) filter (where tr.team_name = match_row.team_b)
  into home_event_count, away_event_count
  from public.match_goal_events e
  join public.team_rosters tr on tr.id = e.team_roster_id
  where e.match_id = match_row.id and e.revoked_at is null;

  insert into live_events_private.match_score_update_authorizations (backend_pid, transaction_id, match_id, operation)
  values (pg_backend_pid(), pg_current_xact_id(), match_row.id, 'score_event')
  on conflict do nothing;
  update public.matches
  set home_goals = live_event_base_home_goals + home_event_count,
      away_goals = live_event_base_away_goals + away_event_count
  where id = match_row.id;
  return event_row;
end;
$$;

create or replace function public.update_match_goal_event(
  p_event_id uuid,
  p_team_roster_id uuid,
  p_roster_player_id uuid,
  p_match_minute smallint,
  p_actor uuid
)
returns public.match_goal_events
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.match_goal_events%rowtype;
  match_row public.matches%rowtype;
  team_row public.team_rosters%rowtype;
  home_event_count integer;
  away_event_count integer;
begin
  if p_actor is null or not exists (select 1 from auth.users where id = p_actor) then
    raise exception 'ACTOR_REQUIRED';
  end if;
  if p_match_minute is null or p_match_minute not between 1 and 150 then raise exception 'INVALID_EVENT_MINUTE'; end if;

  select m.* into match_row
  from public.matches m
  join public.match_goal_events e on e.match_id = m.id
  where e.id = p_event_id
  for update of m;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;

  select * into event_row
  from public.match_goal_events
  where id = p_event_id
  for update;
  if event_row.revoked_at is not null then raise exception 'EVENT_ALREADY_REVOKED'; end if;
  if not match_row.live_events_enabled then raise exception 'LIVE_EVENTS_NOT_ENABLED'; end if;

  select * into team_row
  from public.team_rosters
  where id = p_team_roster_id and bracket_id = match_row.bracket_id;
  if not found or team_row.team_name is null
    or (team_row.team_name <> match_row.team_a and team_row.team_name <> match_row.team_b) then
    raise exception 'TEAM_NOT_IN_MATCH';
  end if;
  if not exists (
    select 1 from public.roster_players
    where id = p_roster_player_id and roster_id = p_team_roster_id
  ) then raise exception 'PLAYER_TEAM_MISMATCH'; end if;

  update public.match_goal_events
  set team_roster_id = p_team_roster_id,
      roster_player_id = p_roster_player_id,
      match_minute = p_match_minute,
      updated_by = p_actor,
      updated_at = now()
  where id = p_event_id
  returning * into event_row;

  select
    count(*) filter (where tr.team_name = match_row.team_a),
    count(*) filter (where tr.team_name = match_row.team_b)
  into home_event_count, away_event_count
  from public.match_goal_events e
  join public.team_rosters tr on tr.id = e.team_roster_id
  where e.match_id = match_row.id and e.revoked_at is null;

  insert into live_events_private.match_score_update_authorizations (backend_pid, transaction_id, match_id, operation)
  values (pg_backend_pid(), pg_current_xact_id(), match_row.id, 'score_event')
  on conflict do nothing;
  update public.matches
  set home_goals = live_event_base_home_goals + home_event_count,
      away_goals = live_event_base_away_goals + away_event_count
  where id = match_row.id;
  return event_row;
end;
$$;

-- Existing card_events remain the only persisted card records. This wrapper
-- adds minute-aware idempotency while reusing the established card RPC.
create or replace function public.create_live_card_event(
  p_bracket_id uuid,
  p_match_id uuid,
  p_roster_player_id uuid,
  p_team_roster_id uuid,
  p_card_type text,
  p_match_minute smallint,
  p_idempotency_key uuid,
  p_actor uuid
)
returns public.card_events
language plpgsql
security definer
set search_path = public
as $$
declare
  idempotency_row public.card_event_idempotency%rowtype;
  event_row public.card_events%rowtype;
  match_row public.matches%rowtype;
begin
  if p_actor is null or not exists (select 1 from auth.users where id = p_actor) then
    raise exception 'ACTOR_REQUIRED';
  end if;
  if p_match_minute is null or p_match_minute not between 1 and 150 then raise exception 'INVALID_EVENT_MINUTE'; end if;
  if p_idempotency_key is null or p_card_type not in ('yellow', 'direct_red', 'second_yellow_red') then
    raise exception 'INVALID_EVENT';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 1));

  select * into idempotency_row
  from public.card_event_idempotency
  where idempotency_key = p_idempotency_key;
  if found then
    if idempotency_row.card_event_id is null then raise exception 'IDEMPOTENCY_EVENT_ALREADY_DELETED'; end if;
    select * into event_row from public.card_events where id = idempotency_row.card_event_id;
    if not found then raise exception 'IDEMPOTENCY_EVENT_ALREADY_DELETED'; end if;
    if event_row.bracket_id is distinct from p_bracket_id
      or event_row.match_id is distinct from p_match_id
      or event_row.roster_player_id is distinct from p_roster_player_id
      or event_row.team_roster_id is distinct from p_team_roster_id
      or event_row.card_type is distinct from p_card_type
      or event_row.match_minute is distinct from p_match_minute then
      raise exception 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH';
    end if;
    return event_row;
  end if;

  select * into match_row
  from public.matches
  where id = p_match_id
  for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  if match_row.is_live is distinct from true
    or match_row.status is null
    or match_row.status not in ('الشوط الأول', 'استراحة', 'الشوط الثاني', 'ضربات جزاء') then
    raise exception 'MATCH_NOT_LIVE';
  end if;

  event_row := public.create_card_event(
    p_bracket_id, p_match_id, p_roster_player_id, p_team_roster_id,
    p_card_type, p_idempotency_key, p_actor
  );
  update public.card_events
  set match_minute = p_match_minute
  where id = event_row.id
  returning * into event_row;
  return event_row;
end;
$$;

create or replace function public.correct_match_live_score(
  p_match_id uuid,
  p_new_base_home_goals integer,
  p_new_base_away_goals integer,
  p_reason text,
  p_actor uuid
)
returns public.matches
language plpgsql
security definer
set search_path = pg_catalog, public, live_events_private
as $$
declare
  match_row public.matches%rowtype;
  current_actor_role text;
  active_goal_count_home bigint;
  active_goal_count_away bigint;
  old_base_home integer;
  old_base_away integer;
  old_score_home bigint;
  old_score_away bigint;
  recalculated_home bigint;
  recalculated_away bigint;
begin
  if p_actor is null
    or not exists (
      select 1
      from public.admin_profiles ap
      where ap.user_id = p_actor
        and ap.is_active is true
        and ap.role_key is not null
    ) then
    raise exception 'SCORE_CORRECTION_FORBIDDEN';
  end if;

  select ap.role_key into current_actor_role
  from public.admin_profiles ap
  where ap.user_id = p_actor
    and ap.is_active is true;

  if exists (
    select 1
    from public.admin_permission_overrides apo
    where apo.user_id = p_actor
      and apo.permission_key = 'matches.live.correct_score'
      and apo.effect = 'deny'
  ) or not (
    exists (
      select 1
      from public.admin_role_permissions arp
      where arp.role_key = current_actor_role
        and arp.permission_key = 'matches.live.correct_score'
    )
    or exists (
      select 1
      from public.admin_permission_overrides apo
      where apo.user_id = p_actor
        and apo.permission_key = 'matches.live.correct_score'
        and apo.effect = 'allow'
    )
  ) then
    raise exception 'SCORE_CORRECTION_FORBIDDEN';
  end if;

  if p_new_base_home_goals is null or p_new_base_away_goals is null
    or p_new_base_home_goals < 0 or p_new_base_away_goals < 0 then
    raise exception 'INVALID_SCORE_BASELINE';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then
    raise exception 'SCORE_CORRECTION_REASON_REQUIRED';
  end if;

  select * into match_row
  from public.matches
  where id = p_match_id
  for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  if not match_row.live_events_enabled
    or match_row.live_event_base_home_goals is null
    or match_row.live_event_base_away_goals is null then
    raise exception 'LIVE_EVENTS_NOT_ENABLED';
  end if;

  select
    count(*) filter (where tr.team_name = match_row.team_a),
    count(*) filter (where tr.team_name = match_row.team_b)
  into active_goal_count_home, active_goal_count_away
  from public.match_goal_events e
  join public.team_rosters tr on tr.id = e.team_roster_id
  where e.match_id = p_match_id
    and e.revoked_at is null;

  old_base_home := match_row.live_event_base_home_goals;
  old_base_away := match_row.live_event_base_away_goals;
  old_score_home := coalesce(match_row.home_goals, 0);
  old_score_away := coalesce(match_row.away_goals, 0);
  recalculated_home := p_new_base_home_goals::bigint + active_goal_count_home;
  recalculated_away := p_new_base_away_goals::bigint + active_goal_count_away;
  if recalculated_home > 2147483647 or recalculated_away > 2147483647 then
    raise exception 'SCORE_OUT_OF_RANGE';
  end if;

  insert into live_events_private.match_score_update_authorizations (backend_pid, transaction_id, match_id, operation)
  values (pg_backend_pid(), pg_current_xact_id(), p_match_id, 'correct_score')
  on conflict do nothing;

  update public.matches
  set live_event_base_home_goals = p_new_base_home_goals,
      live_event_base_away_goals = p_new_base_away_goals,
      home_goals = recalculated_home,
      away_goals = recalculated_away
  where id = p_match_id
  returning * into match_row;

  insert into live_events_private.match_score_corrections (
    match_id, actor_user_id, reason,
    old_base_home_goals, old_base_away_goals,
    new_base_home_goals, new_base_away_goals,
    old_home_goals, old_away_goals, new_home_goals, new_away_goals
  ) values (
    p_match_id, p_actor, btrim(p_reason),
    old_base_home,
    old_base_away,
    p_new_base_home_goals, p_new_base_away_goals,
    old_score_home, old_score_away,
    recalculated_home, recalculated_away
  );

  return match_row;
end;
$$;

revoke all on function public.correct_match_live_score(uuid, integer, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.correct_match_live_score(uuid, integer, integer, text, uuid) to service_role;

revoke all on function public.enable_match_live_events(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_match_goal_event(uuid, uuid, uuid, uuid, smallint, uuid, uuid) from public, anon, authenticated;
revoke all on function public.revoke_match_goal_event(uuid, uuid) from public, anon, authenticated;
revoke all on function public.update_match_goal_event(uuid, uuid, uuid, smallint, uuid) from public, anon, authenticated;
revoke all on function public.create_live_card_event(uuid, uuid, uuid, uuid, text, smallint, uuid, uuid) from public, anon, authenticated;

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
  if p_idempotency_key is null or p_card_type not in ('yellow', 'direct_red', 'second_yellow_red') then
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
  select team_name into team_name_value
  from public.team_rosters where id = p_team_roster_id and bracket_id = p_bracket_id;
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
grant execute on function public.enable_match_live_events(uuid, uuid) to service_role;
grant execute on function public.create_match_goal_event(uuid, uuid, uuid, uuid, smallint, uuid, uuid) to service_role;
grant execute on function public.revoke_match_goal_event(uuid, uuid) to service_role;
grant execute on function public.update_match_goal_event(uuid, uuid, uuid, smallint, uuid) to service_role;
grant execute on function public.create_live_card_event(uuid, uuid, uuid, uuid, text, smallint, uuid, uuid) to service_role;
grant execute on function public.create_card_event(uuid, uuid, uuid, uuid, text, uuid, uuid) to service_role;
