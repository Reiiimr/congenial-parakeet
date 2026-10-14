# Changelog

Notable project changes are recorded here, grouped by date and release state.
This log covers the working application in `Modules/local-test-copy`; it does
not describe deployments or changes to the legacy app at the repository root.

## Unreleased

### Vercel/Supabase preparation

- Corrected Vercel setup guidance for the active `Modules/local-test-copy` root
  and documented production/preview environment separation and required cron
  secret.
- Added a new-repository README for placing the application at the repository
  root, plus an authoritative Supabase fresh-install guide with ordered schema
  migrations, role setup, bootstrap password rotation, and legacy snapshot
  warning.
- Added a `system-admin-ready` deployment and launch-blocker checklist.
- Moved local sample fixtures out of public assets and removed the
  production-facing fixture download link.
- Clarified that maintenance cron does not keep a free-tier database awake or
  guarantee availability. No cloud resources were provisioned and nothing was
  deployed or pushed.
- Applied the documented fresh schema sequence successfully in disposable
  PGlite; it created 30 `ekapon` tables, the reference rows for 62 barangays,
  and two bootstrap staff accounts.
- Typecheck, production build, and focused fixture tests passed. The complete
  test run could not initialize three PostgreSQL-backed suites because no
  database was listening on `localhost:5432` (23 tests passed; 49 skipped).
- `npm audit --omit=dev` still reports two moderate React Router advisories;
  the suggested fix is a breaking major-version upgrade. The production build
  also reports the existing large-chunk advisory.

### Paravet account creation

- Updated **Add Paravet** to create the directory record and login-enabled
  account together, then reveal the generated account key and one-time
  temporary password for secure handoff.

### Analytics and reporting

- Improved analytics evidence and record search, report filtering, methodology
  documentation, and branded report headers.
- Removed the **Data scope and limitations**, **Executive AI Insight**, and
  **How to read this** sections from analytics and report views, following the
  later product direction.
- Added live-data planning coverage. Estimates are withheld until at least 10
  dated live service records span at least 3 distinct calendar months; sample
  data does not qualify.
- Added a temporary, account-scoped report basket. Users can select records and
  fields across supported parts of the app and compose a combined report
  without saving a shared or persistent report.

### Spay and Neuter Monthly Report

- Added a logo-branded Excel workbook template using the supplied report
  structure, with strict headers, monthly sections, and formula totals.
- Added workbook preview and validation, import to searchable live service
  records, duplicate-file protection, and guarded import undo.
- Added populated workbook export of imported records, filterable by year,
  optional month, and optional barangay. Export totals are recalculated and
  exports are limited to 2,000 records.
- Documented the file contract and API in
  [API-05-reporting-and-census-review.md](./docs/API-05-reporting-and-census-review.md).

### Census review

- Added status history and Admin/SuperAdmin status editing for Pending,
  Approved, and Rejected submissions.
- Added guarded undo/redo for approvals. Registry changes are restored only
  when the affected owner and pet records still match the saved state; older
  approvals without snapshots are reported as not safely undoable.
- Added traditional-layout, read-only Summary and Door-to-door views to
  submission details.

### Validation

- Backend and frontend TypeScript checks passed.
- Production frontend build passed; Vite reported its advisory large-chunk
  warning.
- All 5 focused workbook tests passed.
- Migrations 000–010 applied successfully in an isolated in-memory PGlite
  database.
- Database-backed integration and full test suites were attempted but could not
  connect to PostgreSQL at `localhost:5432`; those suites are not verified by
  this run.
