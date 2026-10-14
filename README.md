# e-Kapon

City Veterinary Office dashboard and API. This repository is designed for a
Vercel-hosted React/Vite frontend and serverless API backed by Supabase
PostgreSQL.

## New deployment

1. Create a **private** GitHub repository for this application. Put the
   contents of this application folder at the repository root (including
   `package.json`, `package-lock.json`, `api/`, `api-handlers/`, `db/`, and
   `server/`). Do not copy `node_modules/`, `dist/`, `.local-test-db/`, or any
   `.env` file. Keep `.env.example`.
2. Create a new Supabase project. Follow the fresh-database sequence in
   [db/README.md](./db/README.md) exactly. It is the authoritative schema
   bootstrap guide; do not run the deprecated
   `db/final_supabase_schema.sql`.
3. Create a new Vercel project linked to the new private repository. Set the
   Root Directory to `.` and use the settings in
   [README-BACKEND.md](./README-BACKEND.md). Set Production environment
   variables only after the Supabase schema and restricted API role are ready.
4. Use [system-admin-ready](./system-admin-ready) to complete the pre-launch
   checks. Do not put credentials in GitHub, repository files, or `VITE_*`
   variables.

## Local development and verification

Requires Node.js 20 or later.

```powershell
npm ci
npm run dev:test
```

See [README-BACKEND.md](./README-BACKEND.md) for local test credentials,
database-backed test setup, API configuration, and Vercel deployment details.
Do not point local tests or migrations at a production database.

For parallel module development boundaries and contributor prompts, see the
[Module A–D documentation pack](./docs/modules/README.md).
