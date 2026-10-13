<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# MucoCheck Permanent Repository Rules for Coding Agents

These rules are permanent and mandatory for any AI coding agent working in this repository. They take precedence over routine habits or default generation patterns.

---

## 1. Database and SQL Safety Rules

- **NEVER generate or execute destructive SQL** without explicit, specific user authorization.
- **Never use destructive statements**: `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, destructive `DELETE`, or equivalent data-erasing operations as part of routine development.
- **Incremental & Backward-Compatible**: All database changes must be strictly incremental and backward-compatible.
- **Individual Migration Files**: Every database change must be delivered as a separate, clearly named migration file under `supabase/migrations/`, formatted as `YYYYMMDDHHMMSS_<descriptive_name>.sql` (e.g., `supabase/migrations/20261014090000_add_assessment_processing_status.sql`).
- **Migration Documentation**: Every migration must begin with a clear header comment detailing:
  1. Title and purpose
  2. Affected database objects (tables, columns, functions, triggers, policies)
  3. Expected impact and idempotency considerations
- **Ready-to-Run SQL**: Provide complete, copy-pasteable SQL in the file so the user can open it directly in the Supabase SQL Editor.
- **Never silently execute remote DDL/DML**: Never apply remote migrations, modify remote schemas, or run SQL against production or remote instances on the user's behalf.
- **Inspect Schema & Existing Migrations First**: Always inspect `supabase/migrations/` and the current schema before proposing migrations to prevent duplicate columns, conflicting indexes, or broken foreign keys.
- **Prefer Additive Changes**: If a genuinely destructive change becomes unavoidable (e.g. data schema retirement), stop immediately. Explain why, document what data could be lost, provide non-destructive alternatives, and wait for explicit user approval before proceeding.
- **Never bundle unrelated changes**: Each migration file must address a single concern.
- **Idempotency & Verification**: Use `IF EXISTS`, `IF NOT EXISTS`, and safe update patterns. Explain whether the script is safe to re-run and document exact SQL or dashboard steps to verify its success.
- **Do not claim applied status**: Never claim a migration has been applied remotely until the user explicitly confirms it or its application is verified via live checks.

---

## 2. Security and Architecture Rules

- **Never commit credentials, tokens, or private keys**: No Supabase service role keys, publishable keys, API keys, passwords, or session tokens in tracked code or markdown files.
- **Zero Trust on Caller-Supplied Identity**: Never trust caller-supplied teacher IDs, user IDs, or custom identity headers (e.g., `x-teacher-id`) as authentication. In production, identity must be derived exclusively from verified cryptographic sessions (`auth.uid()`, Supabase JWT / cookies).
- **Production Fails Closed**: In production (`NODE_ENV === "production"`), requests lacking a valid authentication session must immediately receive `401 Unauthorized`. Missing required backend infrastructure must throw explicit server errors (`500`) rather than silent degradation.
- **Zero Silent Fallback**: Never silently fall back to local JSON persistence (`.data/db.json`) or local file storage in production. If Supabase is unreachable, fail explicitly.
- **Keep Student Files Private**: Uploaded student answer scripts and reference marking schemes must always be stored in private storage buckets. Never generate or expose public URLs for student examination scripts. Access must require authenticated teacher authorization and signed URLs or authorized streams.
- **Grading Separation**: Always maintain a strict boundary between AI-proposed marks/feedback and teacher-approved marks. Proposed marks must remain provisional until a teacher reviews, edits, and explicitly approves them.
- **Never Fabricate AI Grading**: Never claim mock output or deterministic simulated responses are live AI grading. When AI inference is disabled or pending credentials, clearly label results as simulated/mock (`[MOCK PROVIDER]`).

---

## 3. Development Discipline & Quality

- **Inspect Before Editing**: Always inspect existing code, files, dependencies, and types before making changes.
- **Preserve Working Functionality**: Do not perform sweeping refactors, UI rewrites, or architectural replacements just to impose personal preferences. Preserve existing verified features.
- **Verify with Tests and Builds**: Always execute `npm test` and `npm run build` after changes to ensure zero TypeScript errors, broken imports, or regression failures.
- **Transparent Status Reporting**: Clearly distinguish between features that are genuinely implemented and tested, features that are simulated/mocked, and features that remain planned. Never claim a feature works without verification.
- **Keep Documentation Synchronized**: Update `README.md`, environment examples, and architecture guides whenever project setup or system behavior changes.

