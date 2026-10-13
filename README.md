# MucoCheck — AI Grading Workspace

A standalone, privacy-focused educational productivity web application for teachers designed to manage examination grading, inspect handwritten student scripts, apply rubric-based scoring, and maintain auditable gradebooks.

Built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Supabase PostgreSQL & Auth**. Prepared for **NVIDIA open-source models** via **Nebius Token Factory**.

---

## 1. Project Overview & Current Status

MucoCheck streamlines the examination assessment workflow for teachers. It addresses the end-to-end grading journey:
- Setting up structured assessments with multi-part question rubrics and criteria.
- Enrolling student cohorts and managing answer script attachments.
- Reviewing provisional grading evaluations side-by-side with original student scripts.
- Overriding marks with mandatory rationale logging in an immutable audit trail.
- Aggregating deterministic markbooks with boundary checks, configurable rounding, and grade bands.
- Printing official institutional report cards and exporting RFC4180 CSV markbooks.

### Current Status
- **Application Workspaces & Review UI**: Fully functional and operational.
- **Persistence & Security Layer**: Real Supabase PostgreSQL database store and private Storage bucket integration with server-side authorization and strict production fail-closed semantics.
- **AI Inference Integration**: Prepared with a strict provider abstraction (`GradingProvider`). Currently running in deterministic simulation mode (`MockGradingProvider`) while the team's Nebius Token Factory account review is pending.

---

## 2. Feature Matrix: Implemented vs. Simulated vs. Planned

| Feature Area | Status | Implementation Details |
| :--- | :--- | :--- |
| **Teacher Navigation Shell** | **Functional** | Persistent layout, mobile drawer, responsive header, and live AI mode indicator. |
| **Dashboard & KPI Queue** | **Functional** | Real-time counters for pending scripts, active assessments, approval rates, and quick action shortcuts. |
| **Assessment Setup Wizard** | **Functional** | 4-step guided creation (Metadata, Question Paper & Scheme, Rubric Builder, Student Script Roster). Supports drafts with auto-recovery. |
| **Split-Screen Review Workspace** | **Functional** | Side-by-side view with script preview, per-question criteria evaluation, teacher override controls, and audit history. |
| **Audit Trail & Overrides** | **Functional** | Every manual adjustment records teacher ID, timestamp, prior score, new score, and required reason note. |
| **Deterministic Markbook** | **Functional** | Matrix grid (students × questions), cell-level score validation (`0 <= score <= max`), custom rounding (`half_up`, `floor`, `ceil`), raw-to-scale mapping, and RFC4180 CSV export. |
| **Classes & Student Rosters** | **Functional** | Class creation, student enrollment, cohort switching, and individual test history inspection. |
| **Report Cards & PDF Export** | **Functional** | Official printable report cards with grade bands (`A*` to `F`), subject summaries, and pure client/server PDF generation (`/api/reports/[studentId]/pdf`). |
| **Supabase PostgreSQL Persistence** | **Functional** | Relational mapping across 8 tables with foreign keys and UUID normalization. Fails closed in production with explicit error handling. |
| **Authentication & Authorization** | **Functional** | Production-enforced Supabase session validation (`401 Unauthorized` on missing auth; `403 Forbidden` on cross-teacher access). Isolated dev-mode fallback. |
| **Private File Storage** | **Functional** | Private Supabase Storage buckets (`scripts`, `reference_docs`) with folder-level isolation (`auth.uid()`) and authenticated buffer streaming. |
| **AI Grading Engine** | **Simulated** | `MockGradingProvider` returns deterministic rubric evaluations, handwriting flags, and rationales labeled `[MOCK PROVIDER]`. |
| **Nebius Vision / OCR Pipeline** | **Planned** | Clean `NebiusGradingProvider` client stub ready for NVIDIA Nemotron vision/LLM endpoint integration once API access is granted. |

---

## 3. Architecture

MucoCheck adheres to strict separation of concerns, zero trust on caller-supplied identity headers, and fail-closed production semantics:

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer (UI)                      │
│   Dashboard • Wizard • Split-Screen Review • Markbook Grid  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Fetch / Bearer JWT / Cookie
┌──────────────────────────────▼──────────────────────────────┐
│                    Next.js API Route Layer                  │
│  src/app/api/assessments • /api/results • /api/grading ...  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Server Auth Guard (src/lib/auth/server-auth.ts)       │  │
│  │  - Enforces authenticated teacher session             │  │
│  │  - Rejects untrusted headers in production (401)      │  │
│  │  - Validates resource ownership (403)                 │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
┌──────────────▼─────────────┐ ┌──────────────▼───────────────┐
│     Data Access Layer      │ │      Storage Layer           │
│  src/lib/db/supabase-store │ │  src/lib/storage/file-storage│
│  - Supabase PostgreSQL     │ │  - Supabase Private Buckets  │
│  - Row-Level Security      │ │  - Authenticated streaming   │
│  - Fails closed in prod    │ │  - No public script URLs     │
└──────────────┬─────────────┘ └──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────┐
│                  Grading Abstraction Layer                  │
│                src/lib/grading/engine.ts                    │
│                                                             │
│   ┌───────────────────────────┐ ┌─────────────────────────┐ │
│   │    MockGradingProvider    │ │   NebiusGradingProvider │ │
│   │  (Active Simulation Mode) │ │  (Awaiting API Access)  │ │
│   └───────────────────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Core Architectural Invariants
1. **Zero Caller Trust**: Custom identity headers (`x-teacher-id`) are ignored in production. Teacher identity is derived exclusively from cryptographic Supabase Auth sessions (`auth.uid()`).
2. **Fail-Closed Production**: In `NODE_ENV === "production"`, unauthenticated requests fail with `401 Unauthorized`, and backend outages throw `500 DatabaseServiceError`. There is zero silent fallback to local JSON or disk storage.
3. **Private File Isolation**: Student examination scripts and marking schemes are saved in private Supabase Storage buckets. File downloads route through `/api/files/[...path]` with server-side ownership verification.
4. **Provisional vs. Approved Scores**: AI-generated marks remain provisional proposals until a teacher verifies, optionally adjusts, and explicitly approves them.

---

## 4. Project Structure

```
src/
├── app/
│   ├── page.tsx                           # Teacher overview dashboard & queues
│   ├── layout.tsx                         # Root layout with global shell & styling
│   ├── globals.css                        # Design tokens, variables & print stylesheets
│   ├── assessments/
│   │   ├── page.tsx                       # Filterable assessment registry
│   │   ├── new/page.tsx                   # Guided 4-step creation wizard & draft recovery
│   │   └── [id]/
│   │       ├── page.tsx                   # Assessment overview & script attachment manager
│   │       ├── review/page.tsx            # Split-screen Grading Review Workspace
│   │       └── markbook/page.tsx          # Deterministic Markbook matrix & CSV export
│   ├── results/page.tsx                   # Global results hub
│   ├── classes/page.tsx                   # Class rosters & student management
│   ├── reports/page.tsx                   # Official printable student report cards
│   ├── settings/page.tsx                  # Profile settings, grade bands & AI status
│   └── api/
│       ├── assessments/                   # Assessment CRUD, drafts, scripts & markbooks
│       ├── grading/route.ts               # Server-side grading pipeline orchestrator
│       ├── results/                       # Result approval, rejection, flags & reassignment
│       ├── upload/route.ts                # Private multi-file upload with MIME & size checks
│       ├── files/[...path]/route.ts       # Secure private file streaming endpoint
│       ├── reports/[studentId]/           # Student report card data & PDF generation
│       ├── export-csv/route.ts            # RFC4180 deterministic CSV export
│       └── seed/route.ts                  # Development data seeding (disabled in production)
├── components/
│   ├── layout/Shell.tsx                   # Persistent navigation shell & AI status badge
│   └── ui/                                # Badges, modals, cards, and input controls
├── lib/
│   ├── types.ts                           # Core domain models, enums & interfaces
│   ├── tokens.ts                          # Design tokens (colors, typography, spacing)
│   ├── auth/server-auth.ts                # Server-side authorization & production security guards
│   ├── db/
│   │   ├── get-store.ts                   # Store resolver (SupabaseStore in prod, safe dev fallback)
│   │   ├── supabase-store.ts              # PostgreSQL database repository adapter
│   │   └── server-store.ts                # Development local file store (.data/db.json)
│   ├── storage/file-storage.ts            # Private Supabase Storage manager & stream resolver
│   ├── scoring/deterministic-calculator.ts# Boundary enforcement, rounding modes & scale mapping
│   ├── grading/
│   │   ├── types.ts                       # GradingProvider interface & evaluation schemas
│   │   ├── fixtures.ts                    # Edge-case evaluation fixtures (boundary, unreadable, etc.)
│   │   ├── mock-provider.ts               # Deterministic MockGradingProvider
│   │   ├── nebius-provider.ts             # Nebius Token Factory integration boundary
│   │   └── engine.ts                      # GradingEngine pipeline orchestrator
│   └── reports/pdf-generator.ts           # Pure PDF generation for report cards
scripts/
├── verify-all.ts                          # Automated 93-assertion verification suite
├── test-supabase.ts                       # Supabase connectivity diagnostics
└── migrate-to-supabase.ts                 # Local data migration & backup utility
supabase/
└── migrations/
    ├── 20261013000000_initial_schema.sql  # Core schema, tables, foreign keys & RLS policies
    └── 20261013000001_storage_buckets.sql # Private storage buckets & folder-level RLS policies
```

---

## 5. Local Setup

### Prerequisites
- **Node.js**: v18.17.0 or higher (Node 20+ recommended)
- **npm** or **pnpm**
- A **Supabase project** (Free or Pro tier)

### 1. Clone & Install
```bash
git clone <repository-url>
cd MucoCheck
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Populate `.env.local` with your project's credentials:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Nebius Token Factory (Optional - Leave blank to run in simulation mode)
NEBIUS_API_KEY=
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.ai/v1
NEBIUS_MODEL_NAME=nvidia/llama-3.1-nemotron-70b-instruct
```

### 3. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 6. Supabase Database & Storage Setup

### 1. Database Schema Migration
1. Open your Supabase Project Dashboard and navigate to the **SQL Editor**.
2. Open [`supabase/migrations/20261013000000_initial_schema.sql`](file:///a:/Code/MucoCheck/supabase/migrations/20261013000000_initial_schema.sql).
3. Copy and run the script in the SQL Editor.
   - This creates tables: `profiles`, `classes`, `students`, `assessments`, `assessment_questions`, `student_scripts`, `grading_results`, and `assessment_approvals`.
   - It enables Row-Level Security (RLS) and defines ownership policies scoped to `auth.uid() = teacher_id`.

### 2. Private Storage Buckets Setup
1. In the Supabase SQL Editor, open [`supabase/migrations/20261013000001_storage_buckets.sql`](file:///a:/Code/MucoCheck/supabase/migrations/20261013000001_storage_buckets.sql).
2. Run the script to provision the private buckets:
   - `scripts` (Private, 50MB file size limit, PDF/image MIME validation).
   - `reference_docs` (Private, 50MB file size limit, PDF/image MIME validation).
   - Folder-level RLS policies restricting file uploads, reads, and deletes to `(storage.foldername(name))[1] = auth.uid()::text`.
3. *Alternative (Dashboard UI)*: Go to **Storage > New Bucket**, create `scripts` (disable Public bucket) and `reference_docs` (disable Public bucket).

---

## 7. Data Flow & Grading Lifecycle

```
[Assessment Setup]
  │  Teacher defines questions, max marks, and rubric criteria
  ▼
[Script Attachment]
  │  Answer scripts uploaded to private Supabase Storage ({teacher_id}/...)
  ▼
[Grading Engine Pipeline]
  │  Extracts student responses against rubric criteria
  │  Generates provisional scores, rationale notes, and handwriting ambiguity flags
  ▼
[Split-Screen Teacher Review]
  │  Provisional score displayed with "Proposed" badge
  │  Teacher can:
  │    - Approve proposed mark as-is
  │    - Override mark (system logs teacher ID, prior score, new score, rationale)
  │    - Flag unreadable handwriting
  │    - Reassign script to another student or question
  ▼
[Approved Result & Markbook]
  │  Saved as official AssessmentApproval in database
  │  Aggregated in deterministic Markbook matrix
  ▼
[Report Card & Export]
  │  Printable official student report cards
  │  RFC4180 CSV export for institutional systems
```

---

## 8. Verification & Testing

MucoCheck features an automated test suite verifying scoring arithmetic, security guards, fail-closed production semantics, and file storage rules.

### Run Automated Tests
```bash
npm test
```
Executes `scripts/verify-all.ts` (93 assertions):
- **Scoring & Bounds**: Strict `0 <= score <= max_marks`, rounding modes (`half_up`, `floor`, `ceil`), raw-to-scale mapping.
- **Provider Contracts**: Mock output conformity, error handling, edge-case fixtures.
- **Security & Authorization**:
  - Production `401 Unauthorized` on missing session.
  - Production rejection of custom `x-teacher-id` identity headers.
  - Production `403 Forbidden` on cross-teacher access attempts.
  - Development auth isolation (`isDevAuthAllowed() === false` in production).
- **Persistence Guarantees**:
  - `DatabaseServiceError` thrown in production when Supabase is unreachable (no silent JSON fallback).
  - Production storage failure on local disk fallback attempts.
- **Audit Trails**: Timestamp, teacher identity, and override rationale recording.
- **Reporting**: PDF stream validity and CSV formatting.

### Production Build Check
```bash
npm run build
```
Compiles all 24 application routes with zero TypeScript errors or warnings.

---

## 9. AI Integration Status & Vision/OCR Boundary

The system uses an explicit provider interface:
```typescript
export interface GradingProvider {
  name: string;
  isAvailable(): boolean;
  evaluate(request: GradingRequest): Promise<GradingResponse>;
}
```

### Current Status
- **Provider**: `MockGradingProvider` is currently active.
- **Simulation Transparency**: All mock-evaluated assessments are badged with `[MOCK PROVIDER]` and `MOCK ACTIVE` in the interface.
- **Nebius Integration Boundary**: `src/lib/grading/nebius-provider.ts` is implemented as a clean client stub targeting NVIDIA Nemotron models on Nebius Token Factory. It parses rubric criteria and structured JSON schemas matching the existing domain models.

### What Remains for Live Vision/OCR Grading
1. **Document Page Previews & Rendering**: Reliable multi-page PDF rasterization into high-resolution images (`image/png` or `image/jpeg`).
2. **Page-Level Crop Segmentation**: Extracting individual question regions or bounding boxes from full script pages.
3. **Multimodal Inference**: Passing cropped question images alongside question criteria to the NVIDIA vision/multimodal endpoint on Nebius Token Factory once API credentials are supplied.

---

## 10. Known Limitations & Next Steps

### Known Limitations
1. **Client-Side Document Display**: Script preview currently relies on iframe/object rendering of uploaded PDF buffers. Multi-page navigation requires unified canvas rasterization.
2. **Simulated Evaluations**: Actual handwriting extraction is simulated until vision endpoint integration is completed.

### Immediate Next Steps
1. **Document Processing Pipeline**: Implement a server/client document rasterization module to render PDF pages into inspectable image slices.
2. **Annotation Overlay Canvas**: Add visual pin and annotation overlay controls on student script pages in the Split-Screen Review Workspace.
3. **Live Nebius Integration**: Connect NVIDIA Nemotron vision endpoints once team account approval is granted.