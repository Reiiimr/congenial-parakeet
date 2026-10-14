# Project progress and product discussion

**Updated:** 2026-10-14  
**Scope:** Analytics and reporting work in `Modules/local-test-copy`.

This page records the user-facing goals, decisions made during discussion,
implemented progress, and remaining verification. For endpoint and workbook
details, see [API-05](./API-05-reporting-and-census-review.md). For a
chronological list of changes, see the [changelog](../CHANGELOG.md).

## Discussion and decisions

### Analytics and report quality

The initial request focused on making findings traceable and understandable:
evidence and source records, reproducible calculations, explanations of grades,
uncertainty, separation of measurements from interpretation, and clear review
of changes and potential bias. The work was scoped to the local React/Vite
application in `Modules/local-test-copy`, preserving current permissions and
source-data boundaries.

The user later asked to remove the **Data scope and limitations**,
**Executive AI Insight**, and **How to read this** sections. That later
direction superseded the earlier request to include a “How to read this”
panel; those sections are not part of the intended presentation.

### Follow-on features

Before implementation, the feature choices were clarified and the plan was
approved:

- **Live planning:** Show an estimate only when there are at least 10 dated
  live service records across 3 distinct calendar months. Synthetic/sample
  records must not satisfy this threshold.
- **Report basket:** Keep selections temporary to the account/browser session;
  do not create a saved or shared report. Existing permissions remain
  authoritative.
- **Spay and Neuter file:** Use `.xlsx` and reproduce the supplied blank
  workbook's structure. Validate the input strictly and make imported data
  searchable. The generated template is the standard to use when preparing a
  workbook.
- **Census statuses:** Support Pending, Approved, and Rejected, with a history
  of changes. Add the traditional Summary and Door-to-door layouts to each
  submission's detail view.
- **Approval reversal:** Allow safe undo/redo only when registry data has not
  changed since the approval. Do not overwrite conflicting edits. The user
  accepted that older approvals with no reliable snapshot cannot be safely
  reversed automatically.
- **Reviewer roles:** The legacy Encoder role maps to Admin, so the controls
  target Admin and SuperAdmin.

## Progress

| Area | Progress |
|---|---|
| Analytics evidence and search | Implemented earlier, including scoped evidence search, data-quality context, and methodology references. |
| Requested section removals | Implemented; the three named sections are removed from the applicable analytics/report views. |
| Live planning threshold | Implemented with live-record and distinct-month coverage; sample data cannot qualify. |
| Report basket | Implemented as session-scoped state with supported entry points for selected records/evidence and field selection. |
| Workbook template and validation | Implemented with the standard headers/month sections, date and barangay validation, non-negative integer procedure counts, and formula-only totals. |
| Workbook import | Implemented as live searchable service records, with exact-file duplicate protection and conflict-guarded undo. |
| Workbook export | Implemented for imported live report records, with year/month/barangay filters and recalculated totals. |
| Census status and history | Implemented for Admin/SuperAdmin, including status edits and review history. |
| Safe approval undo/redo | Implemented for approvals with snapshots; conflicts block reversal, and older unsnapshotted approvals are identified as not safely undoable. |
| Traditional census forms | Implemented as read-only Summary and Door-to-door tabs on submission details. |

The detailed workbook format, endpoint contracts, permissions, and migration
ordering are maintained in [API-05](./API-05-reporting-and-census-review.md).

## Verification status

The latest verification recorded for this work:

- `npm run typecheck` — passed.
- `npm run build` — passed, with the existing/advisory large JavaScript chunk
  warning.
- `npx vitest run tests/spay-neuter-workbook.test.ts` — passed (5 tests).
- Migrations 000–010 — applied successfully in isolated in-memory PGlite.
- `git diff --check` — passed.
- Census and operations integration tests, and the full suite — attempted, but
  could not connect to PostgreSQL at `localhost:5432`. Treat these tests as
  **not verified**, rather than passed.

No deployment or production database migration was performed as part of this
work.

## Remaining follow-up

1. Run the census and workbook API integration tests against the intended
   disposable local database, including the export path.
2. Run the full test suite against that same isolated database and resolve any
   failures.
3. Keep the workbook format contract synchronized with the template/parser if
   the supplied paper form changes.
4. Arrange an independent review of important scoring or methodology changes
   before treating those results as independently validated.
