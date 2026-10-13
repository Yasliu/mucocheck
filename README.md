# MucoCheck — AI Grading Workspace

A standalone educational productivity web application for teachers designed to grade handwritten examination scripts using question rubrics, deterministic mark aggregation, and teacher verification.

Built with **Next.js 16**, **TypeScript**, **Tailwind CSS**, and **Supabase PostgreSQL**. Prepared for **NVIDIA open-source models** via **Nebius Token Factory**.

---

## 1. Visual Design Philosophy

MucoCheck follows the restrained educational productivity philosophy of Mucono:

- **Warm Canvas Palette**: Paper ivory (`#FBF9F5`) and warm surfaces (`#FFFFFF` / `#FAF8F3`).
- **Deep Ink Typography**: High-contrast, readable slate ink typography (`#1C1A17`).
- **Muted Botanical Green Primary**: Botanical sage/forest accent (`#2A5A43`).
- **Restrained Terracotta Secondary**: Subtle terracotta accents (`#C25B3E`) for review alerts and notices.
- **Subtle Borders & Minimal Shadows**: Hairline borders (`#E8E2D5`) without distracting glowing gradients or heavy floating cards.
- **Editorial Hierarchy**: Clean tabular markbooks, split-screen review workspaces, and printable official report cards.

---

## 2. System Architecture

The application enforces a clear separation of concerns:

```
src/
├── app/
│   ├── page.tsx                           # Overview dashboard & KPI queue
│   ├── layout.tsx                         # Root layout with Suspense & Shell
│   ├── globals.css                        # Design tokens, variables & print styles
│   ├── assessments/
│   │   ├── page.tsx                       # Assessments list & filters
│   │   ├── new/page.tsx                   # Guided 4-step creation wizard & draft recovery
│   │   └── [id]/
│   │       ├── page.tsx                   # Assessment detail & file management
│   │       ├── review/page.tsx            # Split-screen Grading Review Workspace & audit trails
│   │       └── markbook/page.tsx          # Deterministic Markbook matrix, scale converter & inline editor
│   ├── results/page.tsx                   # Results & Markbook hub
│   ├── classes/page.tsx                   # Classes & student roster management
│   ├── reports/page.tsx                   # Official printable & downloadable student report cards
│   ├── settings/page.tsx                  # Teacher profile, grade bands & AI status
│   └── api/
│       ├── assessments/                   # REST endpoints for assessment CRUD & drafts
│       ├── grading/route.ts               # Server-side grading pipeline invocation
│       ├── results/                       # Result approval, rejection, unreadable flag, reassignment
│       ├── upload/route.ts                # Private multi-file upload endpoint (with 25MB validation)
│       ├── files/[...path]/route.ts       # Secure private file streaming endpoint
│       ├── reports/[studentId]/           # Report data & PDF generation endpoints
│       ├── export-csv/route.ts            # RFC4180 deterministic CSV export
│       └── seed/route.ts                  # Workspace demo data reset endpoint
├── components/
│   ├── layout/
│   │   └── Shell.tsx                      # Persistent navigation shell & AI status
│   └── ui/
│       ├── StatusBadge.tsx                # Status indicator (Draft, Proposed, Needs Review, Approved)
│       └── UncertaintyBadge.tsx           # Extraction confidence & handwriting uncertainty
├── lib/
│   ├── types.ts                           # Core domain models & contracts
│   ├── tokens.ts                          # Centralized design tokens
│   ├── utils.ts                           # Scoring and string formatting helpers
│   ├── db/
│   │   ├── repo.ts                        # Client-side cache & seed store
│   │   └── server-store.ts                # Server-side persistent store (.data/db.json) with audit trail
│   ├── scoring/
│   │   └── deterministic-calculator.ts    # Deterministic arithmetic, rounding & bounds
│   ├── grading/
│   │   ├── types.ts                       # GradingProvider interface & extraction models
│   │   ├── fixtures.ts                    # Representative grading fixtures for all edge cases
│   │   ├── mock-provider.ts               # Deterministic MockGradingProvider
│   │   ├── nebius-provider.ts             # Nebius Token Factory NVIDIA LLM provider (isolated stub)
│   │   └── engine.ts                      # GradingEngine orchestrator
│   ├── storage/
│   │   ├── validation.ts                  # Client-safe file & MIME validation helpers
│   │   └── file-storage.ts                # Private storage (.data/storage/uploads) & streaming
│   ├── reports/
│   │   └── pdf-generator.ts               # Pure PDF generation for report cards
│   └── supabase/
│       ├── client.ts                      # Browser Supabase client
│       └── server.ts                      # Server-side Supabase SSR client
├── scripts/
│   └── verify-all.ts                      # Automated verification test suite (66 assertions)
└── supabase/
    └── migrations/
        └── 20261013000000_initial_schema.sql # PostgreSQL schema with RLS & constraints
```

---

## 3. What is Functional vs. What is Simulated

### Fully Functional
1. **Interactive Navigation Shell**: Persistent sidebar, mobile drawer, quick "+ New Assessment" CTA, and real-time AI provider status badge.
2. **Dashboard**: Live metrics, recent assessment queues, active cohort counters, and empty state fallbacks.
3. **Assessment Creation & Draft Flow**:
   - Save drafts at any stage and reopen without losing data (`/assessments/new?draftId=...`).
   - Metadata (name, subject, grade, section, max marks, date).
   - Question paper and marking scheme upload with real multipart file persistence in `.data/storage/uploads/`.
   - Per-question rubric builder with criteria breakdown.
   - Student roster assignment and script upload with MIME type / 25MB validation.
4. **Grading Review Workspace & Full Auditability**:
   - Split-screen workspace with original student script preview and detected answer crops.
   - Question-by-question rubric criteria checklist.
   - AI proposed score vs. teacher approved score distinction.
   - Full audit history logging on every modification (storing timestamp, teacher name, previous score, new score, and reason).
   - Answer reassignment to correct misattributed question matches.
   - Flag unreadable handwriting without silently penalizing students.
   - Individual question approval and "Approve Entire Script" batch action.
5. **Deterministic Markbook**:
   - Question columns x student rows matrix.
   - Instant score recalculation upon cell editing.
   - Strict score boundary enforcement (`0 <= score <= max_marks`).
   - Configurable rounding modes (`half_up`, `floor`, `ceil`).
   - Configurable raw-to-scale conversion (Raw, /50, /100, custom scale).
   - Missing questions explicitly flagged rather than coerced to zero.
   - One-click RFC4180 CSV export endpoint (`/api/export-csv`).
6. **Classes & Students Management**:
   - Cohort switcher, class creation and editing.
   - Student enrollment and roster table.
   - Student assessment history modal showing all previous tests and scores.
7. **Official Report Cards**:
   - Student selector with subject-wise score breakdowns.
   - Clear distinction between raw marks and converted percentages.
   - Configurable grade bands (A*, A, B, C, D, E, F).
   - Downloadable official PDF generation (`/api/reports/[studentId]/pdf`).
   - Clean printable layout with institutional headers, registrar signatures, and `@media print` styling.
8. **Private Storage & Dual Persistence**:
   - Private storage layer in `.data/storage/uploads/` with subfolders for papers, schemes, and scripts.
   - Secure private streaming endpoint at `/api/files/[...path]`.
   - Server-side persistent database store (`.data/db.json`) preserving assessments, scripts, questions, audit records, and markbook states across server restarts.
   - PostgreSQL schema with Row-Level Security in `supabase/migrations/20261013000000_initial_schema.sql`.
9. **Settings**:
   - Teacher profile, school name, department, default marks.
   - Interactive grade bands threshold editor.
   - AI provider status card with key entry and model selection.

### Simulated
1. **MockGradingProvider**:
   - The Nebius account is currently awaiting team review. Development is non-blocked.
   - The application uses `MockGradingProvider` returning deterministic, structured sample evaluations with criteria satisfied, rationales, and handwriting ambiguity flags.
   - **No Live Model Fabrication**: The application never fabricates successful live API calls when unconfigured. Results generated in mock mode are transparently badged with `[MOCK PROVIDER]` and `MOCK ACTIVE`.

---

## 4. Environment Variables

Create a `.env.local` file in the project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://rwbpxwxnxjfzhajqteje.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_wDCLZVgj5tLvvn2Y57eFCg_k79O9I-_

# Nebius Token Factory (NVIDIA Open-Source Model Integration - Awaiting Team Review)
NEBIUS_API_KEY=
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.ai/v1
NEBIUS_MODEL_NAME=nvidia/llama-3.1-nemotron-70b-instruct
```

---

## 5. Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Verification Tests
```bash
npm test
```
Runs the **66-point deterministic verification suite** testing score boundaries, rounding, grade bands, mock provider outputs, Nebius error handling, file storage, MIME validation, draft lifecycle, audit trail logging, question reassignment, unreadable handwriting flagging, raw-to-scale conversion, and PDF generation.

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production
```bash
npm run build
```

---

## 6. What Remains Before Real AI Grading Can Be Enabled

Once the Nebius account team review is approved:
1. Provide the approved `NEBIUS_API_KEY` in `.env.local` or via the **Settings** page.
2. The `nebius-provider.ts` module will automatically route assessment requests to `https://api.tokenfactory.nebius.ai/v1/chat/completions` using `nvidia/llama-3.1-nemotron-70b-instruct` or `nvidia/nemotron-mini-4b-instruct`.
3. The frontend and database schemas require **zero modifications** — the grading output schema, question rubrics, uncertainty statuses, and audit tracking are already built to match the model's structured JSON output.