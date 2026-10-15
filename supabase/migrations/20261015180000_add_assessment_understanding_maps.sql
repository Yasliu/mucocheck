-- ==============================================================================
-- Migration: Add Assessment Understanding Maps
-- File: supabase/migrations/20261015180000_add_assessment_understanding_maps.sql
-- ==============================================================================
--
-- 1. TITLE & PURPOSE:
--    Introduces the `assessment_understanding_maps` table to store structured
--    internal metadata interpreting the syllabus, question paper, and marking
--    scheme hierarchy (including Cambridge IGCSE 0580 M/A/B/SC/FT mark rules,
--    nested sub-questions, diagram references, and document page/region coordinates).
--
--    The uploaded Question Paper and Marking Scheme remain authoritative; this
--    table stores the internal structural interpretation reusable across multiple
--    student answer scripts.
--
-- 2. AFFECTED OBJECTS:
--    - Table created: `public.assessment_understanding_maps`
--    - Indexes:
--        - `idx_understanding_maps_assessment_id`
--        - `idx_understanding_maps_status`
--    - RLS Policies:
--        - "Teachers can read understanding maps for their own assessments"
--        - "Teachers can insert understanding maps for their own assessments"
--        - "Teachers can update understanding maps for their own assessments"
--        - "Teachers can delete understanding maps for their own assessments"
--
-- 3. IMPACT & IDEMPOTENCY:
--    - Strictly incremental and backward-compatible.
--    - Does not alter, drop, or truncate any existing tables or data.
--    - Uses `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and safe
--      policy dropping before re-creation to ensure it is 100% idempotent and
--      safe to re-run multiple times in the Supabase SQL Editor.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.assessment_understanding_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('not_generated', 'proposed', 'verified', 'stale')),
    syllabus_code TEXT,
    paper_code TEXT,
    exam_session TEXT,
    source_question_paper JSONB NOT NULL,
    source_marking_scheme JSONB NOT NULL,
    total_max_marks NUMERIC(5,1) NOT NULL DEFAULT 0,
    total_questions_count INT NOT NULL DEFAULT 0,
    nodes JSONB NOT NULL DEFAULT '[]'::JSONB,
    unresolved_items_count INT NOT NULL DEFAULT 0,
    has_ambiguities BOOLEAN NOT NULL DEFAULT false,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    teacher_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_assessment_understanding_maps_assessment_id UNIQUE (assessment_id)
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_understanding_maps_assessment_id 
    ON public.assessment_understanding_maps(assessment_id);

CREATE INDEX IF NOT EXISTS idx_understanding_maps_status 
    ON public.assessment_understanding_maps(status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.assessment_understanding_maps ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies: Allow authenticated teachers to read/write their own assessment understanding maps
DO $$
BEGIN
    DROP POLICY IF EXISTS "Teachers can read understanding maps for their own assessments" 
        ON public.assessment_understanding_maps;
    DROP POLICY IF EXISTS "Teachers can insert understanding maps for their own assessments" 
        ON public.assessment_understanding_maps;
    DROP POLICY IF EXISTS "Teachers can update understanding maps for their own assessments" 
        ON public.assessment_understanding_maps;
    DROP POLICY IF EXISTS "Teachers can delete understanding maps for their own assessments" 
        ON public.assessment_understanding_maps;
END $$;

CREATE POLICY "Teachers can read understanding maps for their own assessments"
    ON public.assessment_understanding_maps
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.assessments a
            WHERE a.id = assessment_understanding_maps.assessment_id
              AND a.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can insert understanding maps for their own assessments"
    ON public.assessment_understanding_maps
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.assessments a
            WHERE a.id = assessment_understanding_maps.assessment_id
              AND a.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can update understanding maps for their own assessments"
    ON public.assessment_understanding_maps
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.assessments a
            WHERE a.id = assessment_understanding_maps.assessment_id
              AND a.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can delete understanding maps for their own assessments"
    ON public.assessment_understanding_maps
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.assessments a
            WHERE a.id = assessment_understanding_maps.assessment_id
              AND a.teacher_id = auth.uid()
        )
    );
