# Supabase schema setup

This guide is for a **brand-new Supabase project with an empty database**. The
numbered SQL files are the source of truth. Run them in the Supabase SQL Editor
in the order below; do not use the partial legacy snapshot
[`final_supabase_schema.sql`](./final_supabase_schema.sql).

## Fresh project: exact order

1. Run [`000_ekapon_schema.sql`](./000_ekapon_schema.sql). It creates the
   `ekapon` and `extensions` schemas, base auth/account/operations tables,
   helper functions, indexes, initial reference data, and bootstrap staff
   accounts.
2. Run [`001_create_api_role.sql`](./001_create_api_role.sql) **after replacing
   its placeholder password only in the SQL Editor**. This creates the
   restricted `ekapon_api` login used by the Vercel API. Do not commit a
   modified copy containing a real password. If the role already exists, this
   script does not rotate its password; rotate it explicitly in Supabase and
   update Vercel's `DATABASE_URL` together.
3. Run [`005_census_submissions.sql`](./005_census_submissions.sql), then
   [`006_census_submitter_retention.sql`](./006_census_submitter_retention.sql).
4. In [`007_operations.sql`](./007_operations.sql), select and run only the
   standalone statement under **PART 1** (`ALTER TYPE ... ADD VALUE`). Run it
   as its own SQL Editor request and wait for success.
5. In a separate SQL Editor request, run **PART 2** of `007_operations.sql`,
   beginning at `BEGIN;` and ending at `COMMIT;`. This intentionally replaces
   the empty census submission table created by 005/006. It aborts if that
   table contains submissions; never remove that safeguard or run this against
   a populated database as if it were a fresh install.
6. Run [`008_profile_preferences_undo.sql`](./008_profile_preferences_undo.sql),
   [`009_notification_archive.sql`](./009_notification_archive.sql), and
   [`010_reporting_workflows.sql`](./010_reporting_workflows.sql), in that
   order.

`002_fix_verify_password.sql` is a repair migration for selected older
installations; `003_dashboard_records.sql` and `004_dashboard_roles.sql` are
for older existing installations. The fresh base schema already contains
those dashboard/role objects, so **do not run 002–004 on a fresh project**.

## Before connecting the application

1. In Supabase, keep the `ekapon` schema out of the exposed Data API schemas.
   The browser must not connect directly to the database. Do not expose
   `ekapon` or enable Data API access to its tables/functions without reviewed,
   tested database policies. PostgreSQL RLS is not currently configured for
   this application.
2. In the Supabase SQL Editor, replace the initial passwords for both
   bootstrap staff accounts before allowing access. Use two different strong
   secrets and do not put them in this repository. Example query shape:

   ```sql
   select ekapon.set_permanent_password(id, '<new-unique-admin-password>')
   from ekapon.accounts where username = 'admin';

   select ekapon.set_permanent_password(id, '<new-unique-encoder-password>')
   from ekapon.accounts where username = 'encoder';
   ```

   Confirm each statement updated exactly one account. Replace the example
   values with the actual secrets only in the Supabase SQL Editor.
3. Confirm the `ekapon_api` role can log in through the Supabase **transaction
   pooler** connection. Configure Vercel `DATABASE_URL` with that restricted
   role and pooler endpoint, not the `postgres` owner or Supabase
   `service_role` key.
4. Enable database SSL enforcement and protect Supabase/Vercel accounts with
   MFA. Review backups, restoration, network restrictions, data retention,
   access, and privacy requirements before loading real records.

## Existing installation

Do not follow the fresh-project sequence on an existing database. Inventory
the deployed schema and applied migrations, take and verify a backup, and
review each applicable numbered migration before applying it. In particular,
`004_dashboard_roles.sql` renames enum values and must only be applied once
where applicable; `007_operations.sql` replaces the census submission table
and refuses to proceed when that table contains rows. The application does
not maintain a migration ledger, so the administrator must establish what has
already run.

## Validation

The local disposable PGlite setup uses the same current schema migration
sequence. Before deployment, run `npm run typecheck`, `npm test`, and
`npm run build` from the application root. Database-backed tests require the
isolated test database described in the main setup guide; never point them at
production.
