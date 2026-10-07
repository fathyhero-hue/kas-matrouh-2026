-- Link new cards to the match that produced them without guessing historical data.
-- Existing cards remain valid and are excluded from automatic suspension sequences until assigned.

alter table public.cards
  add column if not exists match_id uuid references public.matches(id) on delete set null;

create index if not exists cards_match_id_idx on public.cards(match_id);
