# MucoCheck — Supabase Database Migration & Security Guide

This document outlines the migration procedure from local JSON storage to Supabase PostgreSQL, Auth, and Private Storage with Row-Level Security (RLS).

---

## 1. Architecture Overview

MucoCheck features a resilient persistence and security architecture:

1. **Supabase PostgreSQL & Auth (Primary Production Layer)**:
   - Core relational schema in `supabase/migrations/20261013000000_initial_schema.sql`.
   - Complete Row-Level Security (RLS) policies on every table (`profiles`, `classes`, `students`, `assessments`, `assessment_questions`, `student_scripts`, `grading_results`, `assessment_approvals`).
   - Private Storage Buckets: `scripts` and `reference_docs` with folder-based RLS matching `(storage.foldername(name))[1] = auth.uid()::text`.
2. **Server-Side Authorization Layer (`src/lib/auth/server-auth.ts`)**:
   - Every protected API route enforces caller authentication and resource ownership.
   - In **production** (`NODE_ENV === "production"`), requests without a valid Supabase Auth session fail closed immediately with `401 Unauthorized`.
   - Caller-supplied custom identity headers (e.g. `x-teacher-id`) are **strictly ignored and never trusted** as authentication in production.
   - Cross-teacher access attempts are denied with `403 Forbidden`.
   - Development bypass is isolated behind `isDevAuthAllowed()` and is impossible to activate in production.
3. **Data Access Layer (`src/lib/db/get-store.ts` & `src/lib/db/supabase-store.ts`)**:
   - Routes read and write via `SupabaseStore` using the authenticated client.
   - In production, database outages throw explicit errors (`DatabaseServiceError`); the system **never silently falls back to local JSON**.
4. **Private Storage Layer (`src/lib/storage/file-storage.ts`)**:
   - Files are stored in private buckets with signed URLs or authenticated buffer streaming.
   - No public URLs are ever exposed for student scripts.

---

## 2. Storage Bucket Provisioning

Because Supabase storage bucket creation requires storage administrator privileges:

1. Open your Supabase Dashboard: `https://supabase.com/dashboard/project/<your-project-id>`.
2. Go to the **SQL Editor** tab.
3. Run the SQL script in `supabase/migrations/20261013000001_storage_buckets.sql`:
   ```sql
   INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
   VALUES
     ('scripts', 'scripts', false, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
     ('reference_docs', 'reference_docs', false, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
   ON CONFLICT (id) DO UPDATE SET public = false;
   ```
4. Verify under **Storage > Buckets** that both `scripts` and `reference_docs` appear with the **Private** badge.

---

## 3. Data Backfill Procedure (from `.data/db.json` to Supabase)

To backfill historical local data into Supabase:

1. Run the backfill script:
   ```bash
   npm run migrate:supabase
   ```
2. The script creates a safety snapshot in `.data/backups/`, parses existing local classes, students, and assessments, maps synthetic IDs to valid UUIDs, and upserts them into your Supabase database.

---

## 4. Row-Level Security (RLS) Policy Summary

| Table | RLS Policy | Access Rule |
| :--- | :--- | :--- |
| `profiles` | Users can access own profile | `auth.uid() = id` |
| `classes` | Teachers can access own classes | `auth.uid() = teacher_id` |
| `students` | Teachers can access own students | `auth.uid() = teacher_id` |
| `assessments` | Teachers can access own assessments | `auth.uid() = teacher_id` |
| `assessment_questions` | Teachers can access own assessment questions | `EXISTS (SELECT 1 FROM assessments a WHERE a.id = assessment_id AND a.teacher_id = auth.uid())` |
| `student_scripts` | Teachers can access own student scripts | `EXISTS (SELECT 1 FROM assessments a WHERE a.id = assessment_id AND a.teacher_id = auth.uid())` |
| `grading_results` | Teachers can access own grading results | `EXISTS (SELECT 1 FROM assessments a WHERE a.id = assessment_id AND a.teacher_id = auth.uid())` |
| `assessment_approvals` | Teachers can access own approvals | `auth.uid() = teacher_id` |
| `storage.objects` (upload) | Teacher storage upload | `bucket_id IN ('scripts', 'reference_docs') AND (storage.foldername(name))[1] = auth.uid()::text` |
| `storage.objects` (read) | Teacher storage read | `bucket_id IN ('scripts', 'reference_docs') AND (storage.foldername(name))[1] = auth.uid()::text` |
