-- Preserve the existing player/team snapshots while adding stable roster identity.
-- Existing historical rows remain valid because both columns are nullable.

alter table public.goals
  add column if not exists roster_player_id uuid references public.roster_players(id) on delete set null,
  add column if not exists team_roster_id uuid references public.team_rosters(id) on delete set null;

alter table public.cards
  add column if not exists roster_player_id uuid references public.roster_players(id) on delete set null,
  add column if not exists team_roster_id uuid references public.team_rosters(id) on delete set null;

create index if not exists goals_roster_player_id_idx on public.goals(roster_player_id);
create index if not exists goals_team_roster_id_idx on public.goals(team_roster_id);
create index if not exists cards_roster_player_id_idx on public.cards(roster_player_id);
create index if not exists cards_team_roster_id_idx on public.cards(team_roster_id);
