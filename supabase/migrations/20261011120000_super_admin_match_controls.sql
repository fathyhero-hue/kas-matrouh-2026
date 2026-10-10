-- Super-admin match controls. Historical rows and event idempotency keys stay intact.

alter table public.matches
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid,
  add column if not exists archive_reason text;

create index if not exists matches_active_bracket_schedule_idx
  on public.matches(bracket_id, match_date, match_time)
  where archived_at is null;

drop policy if exists matches_hide_archived_public on public.matches;
create policy matches_hide_archived_public
  on public.matches as restrictive
  for select to anon, authenticated
  using (archived_at is null);

create table if not exists public.match_card_event_exclusions (
  event_id uuid primary key references public.card_events(id) on delete restrict,
  match_id uuid not null references public.matches(id) on delete restrict,
  actor_user_id uuid not null,
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.match_card_event_exclusions enable row level security;
alter table public.match_card_event_exclusions force row level security;
revoke all on table public.match_card_event_exclusions from public, anon, authenticated;
grant select on table public.match_card_event_exclusions to service_role;

create schema if not exists live_events_private;
revoke all on schema live_events_private from public, anon, authenticated, service_role;

create table if not exists live_events_private.match_admin_audit (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches(id) on delete restrict,
  actor_user_id uuid not null,
  action text not null check (action in ('update', 'reset', 'archive', 'restore', 'event_update', 'event_revoke')),
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  old_state jsonb not null,
  new_state jsonb not null,
  created_at timestamptz not null default now()
);
alter table live_events_private.match_admin_audit enable row level security;
alter table live_events_private.match_admin_audit force row level security;
revoke all on table live_events_private.match_admin_audit from public, anon, authenticated, service_role;

create or replace function live_events_private.prevent_match_admin_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'MATCH_ADMIN_AUDIT_IMMUTABLE';
end;
$$;
revoke all on function live_events_private.prevent_match_admin_audit_mutation() from public, anon, authenticated, service_role;
drop trigger if exists match_admin_audit_immutable on live_events_private.match_admin_audit;
create trigger match_admin_audit_immutable
before update or delete on live_events_private.match_admin_audit
for each row execute function live_events_private.prevent_match_admin_audit_mutation();

insert into public.admin_permissions (key, name, description)
values (
  'matches.admin.full_control',
  'Full match administration',
  'Edit, reset, archive, and restore matches using audited administrative RPCs.'
)
on conflict (key) do nothing;

insert into public.admin_role_permissions (role_key, permission_key)
select 'super_admin', 'matches.admin.full_control'
where exists (select 1 from public.admin_roles where key = 'super_admin')
on conflict do nothing;

delete from public.admin_role_permissions
where permission_key = 'matches.delete'
  and role_key <> 'super_admin';

create or replace function public.admin_manage_match(
  p_action text,
  p_match_id uuid,
  p_actor uuid,
  p_patch jsonb default '{}'::jsonb,
  p_reason text default null
)
returns public.matches
language plpgsql
security definer
set search_path = pg_catalog, public, live_events_private
as $$
declare
  match_row public.matches%rowtype;
  candidate public.matches%rowtype;
  actor_role_key text;
  reason_value text := btrim(coalesce(p_reason, ''));
  allowed_fields text[] := array[
    'bracket_id', 'team_a', 'team_a_logo', 'team_b', 'team_b_logo',
    'home_goals', 'away_goals', 'home_penalty_goals', 'away_penalty_goals',
    'match_date', 'match_time', 'day_name', 'venue', 'status', 'is_live',
    'live_minute', 'live_minute_base', 'timer_started_at', 'timer_paused_total',
    'is_timer_running', 'round', 'stage', 'match_label', 'qualified_team',
    'next_match_label', 'next_match_slot'
  ];
  changed_identity boolean;
  home_event_count bigint;
  away_event_count bigint;
  requested_home bigint;
  requested_away bigint;
  new_base_home integer;
  new_base_away integer;
  corrected_match public.matches%rowtype;
  old_state_value jsonb;
  new_state_value jsonb;
begin
  if p_actor is null then raise exception 'MATCH_ADMIN_FORBIDDEN'; end if;
  select ap.role_key into actor_role_key
  from public.admin_profiles ap
  where ap.user_id = p_actor and ap.is_active is true;
  if actor_role_key is null then raise exception 'MATCH_ADMIN_FORBIDDEN'; end if;
  if exists (
    select 1 from public.admin_permission_overrides apo
    where apo.user_id = p_actor
      and apo.permission_key = 'matches.admin.full_control'
      and apo.effect = 'deny'
  ) or not (
    exists (
      select 1 from public.admin_role_permissions arp
      where arp.role_key = actor_role_key
        and arp.permission_key = 'matches.admin.full_control'
    )
    or exists (
      select 1 from public.admin_permission_overrides apo
      where apo.user_id = p_actor
        and apo.permission_key = 'matches.admin.full_control'
        and apo.effect = 'allow'
    )
  ) then
    raise exception 'MATCH_ADMIN_FORBIDDEN';
  end if;
  if p_action not in ('update', 'reset', 'archive', 'restore') then
    raise exception 'INVALID_MATCH_ADMIN_ACTION';
  end if;
  if length(reason_value) not between 1 and 1000 then
    raise exception 'MATCH_ADMIN_REASON_REQUIRED';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'INVALID_MATCH_PATCH';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_patch) as patch_keys(field_name)
    where not field_name = any(allowed_fields)
  ) then
    raise exception 'INVALID_MATCH_PATCH_FIELD';
  end if;
  if p_action <> 'update' and p_patch <> '{}'::jsonb then
    raise exception 'UNEXPECTED_MATCH_PATCH';
  end if;

  select * into match_row from public.matches where id = p_match_id for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;

  old_state_value := jsonb_build_object(
    'match', to_jsonb(match_row),
    'goal_events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.created_at, e.id)
      from public.match_goal_events e where e.match_id = match_row.id
    ), '[]'::jsonb),
    'card_events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.created_at, e.id)
      from public.card_events e where e.match_id = match_row.id
    ), '[]'::jsonb)
  );

  if p_action = 'archive' then
    if match_row.archived_at is null then
      update public.matches
      set archived_at = now(), archived_by = p_actor, archive_reason = reason_value
      where id = match_row.id returning * into match_row;
    end if;
  elsif p_action = 'restore' then
    if match_row.archived_at is not null then
      update public.matches
      set archived_at = null, archived_by = null, archive_reason = null
      where id = match_row.id returning * into match_row;
    end if;
  elsif p_action = 'reset' then
    update public.match_goal_events
    set revoked_at = now(), revoked_by = p_actor, updated_at = now(), updated_by = p_actor
    where match_id = match_row.id and revoked_at is null;

    insert into public.match_card_event_exclusions(event_id, match_id, actor_user_id, reason)
    select e.id, e.match_id, p_actor, reason_value
    from public.card_events e
    where e.match_id = match_row.id
      and e.source_card_id is null
    on conflict (event_id) do nothing;

    if match_row.live_events_enabled then
      insert into live_events_private.match_score_update_authorizations
        (backend_pid, transaction_id, match_id, operation)
      values (pg_backend_pid(), pg_current_xact_id(), match_row.id, 'correct_score')
      on conflict do nothing;
      corrected_match := public.correct_match_live_score(
        match_row.id, 0, 0, reason_value, p_actor
      );
      update public.matches
      set home_penalty_goals = 0,
          away_penalty_goals = 0,
          status = 'لم تبدأ',
          is_live = false,
          live_minute = 0,
          live_minute_base = 0,
          timer_started_at = null,
          timer_paused_total = 0,
          is_timer_running = false
      where id = match_row.id returning * into match_row;
    else
      update public.matches
      set home_goals = 0,
          away_goals = 0,
          home_penalty_goals = 0,
          away_penalty_goals = 0,
          status = 'لم تبدأ',
          is_live = false,
          live_minute = 0,
          live_minute_base = 0,
          timer_started_at = null,
          timer_paused_total = 0,
          is_timer_running = false
      where id = match_row.id returning * into match_row;
    end if;
  else
    candidate := jsonb_populate_record(match_row, p_patch);
    if nullif(btrim(coalesce(candidate.team_a, '')), '') is null
      or nullif(btrim(coalesce(candidate.team_b, '')), '') is null
      or candidate.team_a = candidate.team_b then
      raise exception 'INVALID_MATCH_TEAMS';
    end if;
    if coalesce(candidate.home_goals, -1) < 0 or coalesce(candidate.away_goals, -1) < 0
      or coalesce(candidate.home_penalty_goals, 0) < 0
      or coalesce(candidate.away_penalty_goals, 0) < 0 then
      raise exception 'INVALID_MATCH_SCORE';
    end if;

    changed_identity :=
      candidate.bracket_id is distinct from match_row.bracket_id
      or candidate.team_a is distinct from match_row.team_a
      or candidate.team_b is distinct from match_row.team_b;
    requested_home := candidate.home_goals;
    requested_away := candidate.away_goals;

    select
      count(*) filter (where tr.team_name = candidate.team_a),
      count(*) filter (where tr.team_name = candidate.team_b)
    into home_event_count, away_event_count
    from public.match_goal_events e
    join public.team_rosters tr on tr.id = e.team_roster_id
    where e.match_id = match_row.id and e.revoked_at is null;

    if match_row.live_events_enabled then
      new_base_home := (requested_home - home_event_count)::integer;
      new_base_away := (requested_away - away_event_count)::integer;
      if new_base_home < 0 or new_base_away < 0 then
        raise exception 'SCORE_BELOW_ACTIVE_GOAL_EVENTS';
      end if;
      candidate.live_event_base_home_goals := new_base_home;
      candidate.live_event_base_away_goals := new_base_away;
    end if;

    update public.matches set
      bracket_id = candidate.bracket_id,
      team_a = candidate.team_a,
      team_a_logo = candidate.team_a_logo,
      team_b = candidate.team_b,
      team_b_logo = candidate.team_b_logo,
      home_penalty_goals = candidate.home_penalty_goals,
      away_penalty_goals = candidate.away_penalty_goals,
      match_date = candidate.match_date,
      match_time = candidate.match_time,
      day_name = candidate.day_name,
      venue = candidate.venue,
      status = candidate.status,
      is_live = candidate.is_live,
      live_minute = candidate.live_minute,
      live_minute_base = candidate.live_minute_base,
      timer_started_at = candidate.timer_started_at,
      timer_paused_total = candidate.timer_paused_total,
      is_timer_running = candidate.is_timer_running,
      round = candidate.round,
      stage = candidate.stage,
      match_label = candidate.match_label,
      qualified_team = candidate.qualified_team,
      next_match_label = candidate.next_match_label,
      next_match_slot = candidate.next_match_slot
    where id = match_row.id
    returning * into match_row;

    if match_row.live_events_enabled then
      if requested_home is distinct from match_row.home_goals
        or requested_away is distinct from match_row.away_goals
        or changed_identity then
        corrected_match := public.correct_match_live_score(
          match_row.id, new_base_home, new_base_away, reason_value, p_actor
        );
        match_row := corrected_match;
      end if;
    else
      update public.matches
      set home_goals = requested_home::integer,
          away_goals = requested_away::integer
      where id = match_row.id
      returning * into match_row;
    end if;
  end if;

  new_state_value := jsonb_build_object(
    'match', to_jsonb(match_row),
    'goal_events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.created_at, e.id)
      from public.match_goal_events e where e.match_id = match_row.id
    ), '[]'::jsonb),
    'card_events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.created_at, e.id)
      from public.card_events e where e.match_id = match_row.id
    ), '[]'::jsonb),
    'excluded_card_event_ids', coalesce((
      select jsonb_agg(x.event_id order by x.event_id)
      from public.match_card_event_exclusions x where x.match_id = match_row.id
    ), '[]'::jsonb)
  );
  insert into live_events_private.match_admin_audit
    (match_id, actor_user_id, action, reason, old_state, new_state)
  values (match_row.id, p_actor, p_action, reason_value, old_state_value, new_state_value);
  return match_row;
end;
$$;

revoke all on function public.admin_manage_match(text, uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.admin_manage_match(text, uuid, uuid, jsonb, text) to service_role;

create or replace function public.admin_manage_match_event(
  p_action text,
  p_kind text,
  p_event_id uuid,
  p_match_id uuid,
  p_actor uuid,
  p_team_roster_id uuid default null,
  p_roster_player_id uuid default null,
  p_event_type text default null,
  p_match_minute smallint default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, live_events_private
as $$
declare
  actor_role_key text;
  reason_value text := btrim(coalesce(p_reason, ''));
  match_row public.matches%rowtype;
  goal_row public.match_goal_events%rowtype;
  card_row public.card_events%rowtype;
  old_event jsonb;
  new_event jsonb;
  audit_action text;
begin
  select ap.role_key into actor_role_key
  from public.admin_profiles ap
  where ap.user_id = p_actor and ap.is_active is true;
  if actor_role_key is null
    or exists (
      select 1 from public.admin_permission_overrides apo
      where apo.user_id = p_actor
        and apo.permission_key = 'matches.admin.full_control'
        and apo.effect = 'deny'
    )
    or not (
      exists (
        select 1 from public.admin_role_permissions arp
        where arp.role_key = actor_role_key
          and arp.permission_key = 'matches.admin.full_control'
      )
      or exists (
        select 1 from public.admin_permission_overrides apo
        where apo.user_id = p_actor
          and apo.permission_key = 'matches.admin.full_control'
          and apo.effect = 'allow'
      )
    ) then
    raise exception 'MATCH_ADMIN_FORBIDDEN';
  end if;
  if p_action not in ('update', 'revoke') or p_kind not in ('goal', 'card') then
    raise exception 'INVALID_MATCH_EVENT_ACTION';
  end if;
  if length(reason_value) not between 1 and 1000 then
    raise exception 'MATCH_ADMIN_REASON_REQUIRED';
  end if;
  select * into match_row from public.matches where id = p_match_id for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  if match_row.archived_at is not null then raise exception 'MATCH_ARCHIVED'; end if;

  if p_kind = 'goal' then
    select * into goal_row from public.match_goal_events
    where id = p_event_id and match_id = p_match_id for update;
    if not found then raise exception 'EVENT_NOT_FOUND'; end if;
    old_event := to_jsonb(goal_row);
    if p_action = 'update' then
      goal_row := public.update_match_goal_event(
        p_event_id, p_team_roster_id, p_roster_player_id, p_match_minute, p_actor
      );
    else
      goal_row := public.revoke_match_goal_event(p_event_id, p_actor);
    end if;
    new_event := to_jsonb(goal_row);
  else
    select * into card_row from public.card_events
    where id = p_event_id and match_id = p_match_id for update;
    if not found then raise exception 'EVENT_NOT_FOUND'; end if;
    old_event := to_jsonb(card_row);
    if card_row.source_card_id is not null then
      raise exception 'HISTORICAL_CARD_EVENT_IMMUTABLE';
    end if;
    if p_action = 'update' then
      if p_event_type not in ('yellow', 'direct_red', 'second_yellow_red')
        or p_match_minute is null or p_match_minute not between 1 and 150
        or p_team_roster_id is null or p_roster_player_id is null then
        raise exception 'INVALID_MATCH_EVENT';
      end if;
      if not exists (
        select 1 from public.team_rosters tr
        join public.roster_players rp on rp.roster_id = tr.id
        where tr.id = p_team_roster_id
          and tr.bracket_id = match_row.bracket_id
          and tr.team_name in (match_row.team_a, match_row.team_b)
          and rp.id = p_roster_player_id
      ) then
        raise exception 'PLAYER_TEAM_MISMATCH';
      end if;
      update public.card_events
      set team_roster_id = p_team_roster_id,
          roster_player_id = p_roster_player_id,
          card_type = p_event_type,
          match_minute = p_match_minute
      where id = p_event_id returning * into card_row;
      new_event := to_jsonb(card_row);
    else
      insert into public.match_card_event_exclusions(event_id, match_id, actor_user_id, reason)
      values (card_row.id, card_row.match_id, p_actor, reason_value)
      on conflict (event_id) do nothing;
      new_event := old_event || jsonb_build_object('excluded', true);
    end if;
  end if;

  audit_action := case when p_action = 'update' then 'event_update' else 'event_revoke' end;
  insert into live_events_private.match_admin_audit
    (match_id, actor_user_id, action, reason, old_state, new_state)
  values (
    match_row.id, p_actor, audit_action, reason_value,
    jsonb_build_object('match', to_jsonb(match_row), 'event', old_event),
    jsonb_build_object('match', to_jsonb(match_row), 'event', new_event)
  );
  return jsonb_build_object('match', to_jsonb(match_row), 'event', new_event);
end;
$$;

revoke all on function public.admin_manage_match_event(text, text, uuid, uuid, uuid, uuid, uuid, text, smallint, text) from public, anon, authenticated;
grant execute on function public.admin_manage_match_event(text, text, uuid, uuid, uuid, uuid, uuid, text, smallint, text) to service_role;
