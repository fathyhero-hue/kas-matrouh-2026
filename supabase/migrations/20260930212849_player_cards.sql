-- Player Cards System. Additive and service-role-only; do not alter legacy
-- registrations, rosters, players, matches, results, or historical data.

create table public.player_cards (
  id uuid primary key default gen_random_uuid(),
  roster_player_id uuid references public.roster_players(id) on delete set null,
  team_roster_id uuid references public.team_rosters(id) on delete set null,
  bracket_id uuid references public.brackets(id) on delete set null,
  player_registration_id uuid references public.player_registrations(id) on delete set null,
  card_number text not null unique,
  status text not null default 'ready' check (status in ('draft', 'ready', 'needs_update', 'archived')),
  template_key text not null default 'player-card-v1',
  template_version integer not null default 1 check (template_version > 0),
  display_overrides jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint player_cards_source_required check (roster_player_id is not null or player_registration_id is not null)
);

create unique index player_cards_roster_player_unique_idx
  on public.player_cards(roster_player_id)
  where roster_player_id is not null;

create unique index player_cards_registration_unique_idx
  on public.player_cards(player_registration_id)
  where player_registration_id is not null;

create index player_cards_team_roster_idx on public.player_cards(team_roster_id);
create index player_cards_bracket_status_idx on public.player_cards(bracket_id, status);

alter table public.player_cards enable row level security;
revoke all on table public.player_cards from anon, authenticated;

do $$
begin
  if to_regclass('public.player_cards') is null then
    raise exception 'player_cards migration validation failed: table is missing';
  end if;

  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'player_cards'
      and c.relrowsecurity
  ) then
    raise exception 'player_cards migration validation failed: RLS is not enabled';
  end if;

  if exists (
    select 1 from pg_policy p
    where p.polrelid = 'public.player_cards'::regclass
      and p.polcmd in ('*', 'a', 'w', 'd')
      and (0::oid = any(p.polroles) or p.polroles && array(
        select r.oid from pg_roles r where r.rolname in ('anon', 'authenticated')
      ))
  ) then
    raise exception 'player_cards migration validation failed: client policy exists';
  end if;
end
$$;
