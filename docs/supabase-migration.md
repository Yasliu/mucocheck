# MucoCheck — Supabase Database Migration & Security Guide

This document outlines the migration procedure from local JSON storage to Supabase PostgreSQL, Auth, and Private Storage with Row-Level Security (RLS).

---

## 1. Architecture Overview

MucoCheck features a resilient persistence architecture:

1. **Local Persistent Cache (`.data/db.json`)**:
   - Ensures local offline development, testing, and sessions never lose data.
   - Automatically takes backups before any migration.
2. **Supabase PostgreSQL & Auth**:
   - Full relational schema in `supabase/migrations/20261013000000_initial_schema.sql`.
   - Complete Row-Level Security (RLS) policies on every table (`profiles`, `classes`, `students`, `assessments`, `assessment_questions`, `student_scripts`, `grading_results`, `assessment_approvals`).
   - Private Storage Buckets: `scripts` and `reference_docs` with folder-based RLS matching `auth.uid()`.
3. **Server-Side Authorization Layer (`src/lib/auth/server-auth.ts`)**:
   - Every API route validates caller identity.
   - Enforces teacher resource ownership on GET, POST, PATCH, and DELETE operations.
   - Prohibits cross-teacher data modification and unauthorized file access with `403 Forbidden`.

---

## 2. Backup & Migration Procedure

### Step 1: Create an Automated Data Backup
Run the backup and probe utility:
```bash
npm run migrate:supabase
```
This automatically takes a timestamped snapshot of your current database into `.data/backups/db-backup-<timestamp>.json`.

### Step 2: Apply Database Schema to Remote Supabase
Because an anonymous publishable API key does not have DDL privileges to execute `CREATE TABLE` statements remotely:
1. Open your Supabase Dashboard: [https://supabase.com/dashboard/project/rwbpxwxnxjfzhajqteje](https://supabase.com/dashboard/project/rwbpxwxnxjfzhajqteje).
2. Go to the **SQL Editor** tab on the left sidebar.
3. Open `supabase/migrations/20261013000000_initial_schema.sql` from this repository.
4. Copy and paste the entire script into the SQL editor and click **Run**.
5. This creates all 8 tables, indexes, RLS policies, and private storage buckets (`scripts` and `reference_docs`).

### Step 3: Synchronize Records
Once the schema is applied, execute:
```bash
npm run migrate:supabase
```
The migration script will detect the schema tables and synchronize records.

---

## 3. Row-Level Security (RLS) Policy Summary

| Table | RLS Policy | Access Rule |
| :--- | :--- | :--- |
| `profiles` | Users can access own profile | `auth.uid() = id` |
| `classes` | Teachers can access own classes | `auth.uid() = teacher_id` |
| `students` | Teachers can access own students | `auth.uid() = teacher_id` |
| `assessments` | Teachers can access own assessments | `auth.uid() = teacher_id` |
| `assessment_questions` | Teachers can access own assessment questions | `EXISTS (SELECT 1 FROM assessments a WHERE a.id = assessment_id AND a.teacher_id = auth.uid())` |
| `student_scripts` | Teachers can access own student scripts | `EXISTS (SELECT 1 FROM assessments a WHERE a.id = assessment_id AND a.teacher_id = auth.uid())` |
| `grading_results` | Teachers can access own grading results | `EXISTS (SELECT 1 FROM assessments a WHERE a.id = assessment_id AND a.teacher_id = auth.uid())` |
| `assessment_approvals` | Teachers can manage own approvals | `auth.uid() = teacher_id` |
| `storage.objects` (scripts) | Teacher storage upload & read | `(storage.foldername(name))[1] = auth.uid()::text` |
| `storage.objects` (reference_docs) | Teacher storage upload & read | `(storage.foldername(name))[1] = auth.uid()::text` |

---

## 4. Verification & Testing

Run the automated test suite:
```bash
npm test
```
The test suite verifies:
- Token & cookie authentication resolution
- Cross-user access denial (Teacher A cannot access or alter Teacher B's records)
- Private file streaming protection (unauthorized callers receive 401/403)
- Graceful recovery when remote Supabase tables are unavailable
- Deterministic arithmetic, markbook recalculation, and PDF report card generation
