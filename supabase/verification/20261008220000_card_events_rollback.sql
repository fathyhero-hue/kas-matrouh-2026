-- Conditional rollback review only. This script intentionally performs no DROP/DELETE.
-- A human must review every result and execute a separately approved rollback plan.

select to_regclass('public.card_events') as card_events_table,
       to_regclass('public.card_event_idempotency') as idempotency_table,
       to_regclass('public.public_card_events') as public_view;

select count(*) as event_count,
       count(*) filter (where source_card_id is not null) as historical_event_count,
       count(*) filter (where source_card_id is null) as new_event_count
from public.card_events;

select count(*) as idempotency_count,
       count(*) filter (where card_event_id is null) as deleted_event_keys
from public.card_event_idempotency;

select dependent_view.oid::regclass as dependent_view
from pg_depend dependency
join pg_rewrite rewrite on rewrite.oid = dependency.objid
join pg_class dependent_view on dependent_view.oid = rewrite.ev_class
where dependency.refobjid = 'public.card_events'::regclass;

select routine_schema, routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('create_card_event', 'distribute_card_events', 'prevent_historical_card_event_delete');

select 'STOP: rollback must not remove card_events while rows exist; export/review data first.' as instruction
where exists (select 1 from public.card_events);

select 'STOP: rollback must not remove idempotency ledger while rows exist.' as instruction
where exists (select 1 from public.card_event_idempotency);

-- No destructive statements belong in this file. After approved archival and dependency review,
-- execute a separately reviewed rollback script in a maintenance window.
