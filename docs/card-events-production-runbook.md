# Card Events Production Runbook

This runbook is prepared for project `kfhoibszyssvazwwhcaa`. It contains instructions only. No backup, migration, rollback, database write, commit, push, or deploy is performed by this file.

## Objects And Order

1. `public.card_events` and its UUID/FK/check constraints.
2. `public.card_event_idempotency`, referencing `card_events`.
3. Card event indexes and the historical/idempotency unique indexes.
4. RLS, FORCE RLS, grants, and the `card_events_public_reader` role.
5. `public.public_card_events` view, created through the restricted reader role.
6. Historical-delete trigger and trigger function.
7. `distribute_card_events` RPC and service-role-only execute grant.
8. `create_card_event` RPC and service-role-only execute grant.

Prerequisites are the existing `brackets`, `matches`, `roster_players`, `team_rosters`, `cards`, and `auth.users` tables. Run the postcheck SQL after application.

## Backup Plan

Use a versioned `pg_dump`/`pg_restore` toolchain with a read-capable database connection and a secure destination outside the repository:

```powershell
pg_dump --format=custom --no-owner --file .\secure-backups\matrouh-before-card-events.dump "$DATABASE_URL"
pg_dump --schema-only --file .\secure-backups\matrouh-before-card-events.schema.sql "$DATABASE_URL"
Get-FileHash .\secure-backups\matrouh-before-card-events.dump -Algorithm SHA256
```

The connection string, password, and backup files must never be committed or pasted into reports. `pg_dump` requires network access and a database role permitted to read the schema/data. Confirm encryption and retention with the database owner before use.

## Restore Plan

Restore only into an explicitly selected non-Production database first:

```powershell
createdb "$RESTORE_DATABASE_URL"
pg_restore --clean --if-exists --no-owner --dbname "$RESTORE_DATABASE_URL" .\secure-backups\matrouh-before-card-events.dump
```

For Production restore, stop and obtain an explicit incident approval, verify the target host, and use a tested point-in-time recovery procedure. Do not restore over the live database as a routine rollback.

## Pre-Deploy Checks

- Confirm project ref is `kfhoibszyssvazwwhcaa`.
- Capture `cards` count, yellow/red totals, and fingerprint from `supabase/verification/20261008220000_card_events_postcheck.sql` before application.
- Review migration checksum and run `git diff --check`.
- Confirm no real player data is used in tests.
- Confirm the application release reads `public_card_events` publicly and the Admin server path reads the base table using service role.
- Confirm `card_events_public_reader` is non-login and `nobypassrls`.

## Limited Tests After Application

Read-only tests: postcheck SQL, grants, RLS, view columns, function privileges, triggers, and unchanged `cards` fingerprint.

Requires writes in an isolated test database: create Event, idempotency retry, different-payload rejection, historical distribution, over-total rejection, concurrent distribution, historical-delete rejection, and rollback-on-error. Wrap each isolated test in a transaction and `ROLLBACK` where the test does not need committed state. The idempotency ledger and concurrency tests should use two independent sessions.

Never run these write tests against Production. Production smoke testing should be read-only and verify that incomplete historical records show `يحتاج تحديد المباراة`, never a confirmed suspension or `متاح`.

## Legacy Cards And Public Safety

Legacy aggregate rows remain unchanged. Until their Events are explicitly distributed, Public/Admin must not present a confirmed suspension. The Public page now fails closed to `يحتاج تحديد المباراة` when event data is unavailable or a legacy total has no corresponding event.

## Rollback

Application rollback is preferred before schema rollback. The rollback SQL is review-only and deliberately contains no destructive statement. Do not remove `card_events` or the idempotency ledger while rows exist. Archive and review Events, dependent view/function/trigger objects, and application compatibility first. A migration rollback does not restore deleted or changed data.

## Vercel Rollback

Promote the last known-good Vercel deployment through the Vercel dashboard/CLI. Verify `/`, `/admin/login`, and the cards page after promotion. Code rollback does not reverse the database Migration; keep the old code compatible with additive tables and columns, or use a feature flag to stop Event writes before reverting.

## Compatibility Matrix

- Old code with the new schema: base `cards` remains available; new Event tables are additive.
- New code before migration: unsafe for Public cards because the View/RPC is absent; deploy schema first, then code.
- New code after migration: Public uses the restricted View; Admin uses authorized service-role routes.
- Rollback code after migration: safe only if it does not query the absent View/RPC or if the schema remains installed.

## Full Lint

Targeted ESLint can run on project files. Full lint is currently affected by pre-existing unreadable paths under `node_modules.corrupt`. Safe cleanup is: stop dev/build processes, rename or remove only that local directory after confirming it is not tracked, reinstall from the existing lockfile with `npm ci`, then rerun lint. Do not delete source files, `.env*`, database directories, or lockfiles.
