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
│   │   ├── new/page.tsx                   # Guided 4-step creation wizard
│   │   └── [id]/
│   │       ├── page.tsx                   # Assessment detail & files
│   │       ├── review/page.tsx            # Split-screen Grading Review Workspace
│   │       └── markbook/page.tsx          # Deterministic Markbook matrix & inline editor
│   ├── results/page.tsx                   # Results & Markbook hub
│   ├── classes/page.tsx                   # Classes & student roster management
│   ├── reports/page.tsx                   # Official printable student report cards
│   ├── settings/page.tsx                  # Teacher profile, grade bands & AI status
│   └── api/
│       ├── grading/route.ts               # Server-side grading pipeline invocation
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
│   │   └── repo.ts                        # CRUD repository & resilient seed store
│   ├── scoring/
│   │   └── deterministic-calculator.ts    # Deterministic arithmetic, rounding & bounds
│   ├── grading/
│   │   ├── types.ts                       # GradingProvider interface
│   │   ├── mock-provider.ts               # Deterministic MockGradingProvider
│   │   ├── nebius-provider.ts             # Nebius Token Factory NVIDIA LLM provider
│   │   └── engine.ts                      # GradingEngine orchestrator
│   ├── storage/
│   │   └── file-storage.ts                # Private storage validation & pipeline stages
│   └── supabase/
│       ├── client.ts                      # Browser Supabase client
│       └── server.ts                      # Server-side Supabase SSR client
├── scripts/
│   └── verify-all.ts                      # Automated verification test suite (39 assertions)
└── supabase/
    └── migrations/
        └── 20261013000000_initial_schema.sql # PostgreSQL schema with RLS & constraints
```

---

## 3. What is Functional vs. What is Simulated

### Fully Functional
1. **Interactive Navigation Shell**: Persistent sidebar, mobile drawer, quick "+ New Assessment" CTA, and real-time AI provider status badge.
2. **Dashboard**: Live metrics, recent assessment queues, active cohort counters, and empty state fallbacks.
3. **Assessment Creation Flow**: 4-step wizard:
   - Metadata (name, subject, grade, section, max marks, date)
   - Question paper / rubric upload + interactive per-question criteria builder
   - Student roster assignment and script upload with MIME type / 25MB validation
   - Verification summary and processing architecture review
4. **Grading Review Workspace**:
   - Split-screen workspace with original student script page preview and detected answer crops.
   - Question-by-question rubric criteria checklist.
   - AI proposed score vs. teacher approved score distinction.
   - Handwriting legibility uncertainty flags (`high_confidence`, `medium_confidence`, `high_uncertainty`).
   - Teacher mark edits and feedback comments.
   - Individual question approval and "Approve Entire Script" batch action.
5. **Deterministic Markbook**:
   - Question columns x student rows matrix.
   - Instant score recalculation upon cell editing.
   - Strict score boundary enforcement (`0 <= score <= max_marks`).
   - Configurable rounding modes (`half_up`, `floor`, `ceil`).
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
   - Clean printable layout with institutional headers, registrar signatures, and `@media print` styling.
8. **Settings**:
   - Teacher profile, school name, department, default marks.
   - Interactive grade bands threshold editor.
   - AI provider status card with key entry and model selection.
9. **Database Schema & RLS**:
   - Production SQL migration in `supabase/migrations/20261013000000_initial_schema.sql`.
   - Complete tables for profiles, classes, students, assessments, questions, scripts, grading results, and approvals.
   - Strict Row-Level Security ensuring teachers can only access their own records.

### Simulated
1. **MockGradingProvider**:
   - The Nebius account is currently awaiting team review. Development is non-blocked.
   - The application uses `MockGradingProvider` returning deterministic, structured sample evaluations with criteria satisfied, rationales, and handwriting ambiguity flags.
   - **No Live Model Fabrication**: The application never fabricates successful live API calls when unconfigured. Results generated in mock mode are transparently badged with `[MOCK PROVIDER]` and `MOCK ACTIVE`.

---

## 4. Environment Variables

Create a `.env.local` file in the project root:

```env
# Supabase Configuration (Optional for local testing; repo includes resilient fallback)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Nebius Token Factory (NVIDIA Open-Source Model Integration)
NEBIUS_API_KEY=
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.ai/v1
NEBIUS_MODEL_NAME=nvidia/llama-3.1-nemotron-70b-instruct
```

> **Note**: If `NEXT_PUBLIC_SUPABASE_URL` is omitted, the application runs in local development mode with seed cohorts and persistent state.

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
Runs the 39-point deterministic verification suite testing score boundaries, rounding, grade bands, mock provider outputs, Nebius error handling, and markbook calculations.

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