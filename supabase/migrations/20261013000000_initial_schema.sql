-- MucoCheck: Educational AI Grading Workspace Schema
-- Compatible with Supabase PostgreSQL, Auth, and Storage

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Teacher Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    school_name TEXT DEFAULT 'Mucono Academy',
    department TEXT DEFAULT 'Sciences',
    rounding_mode TEXT DEFAULT 'half_up' CHECK (rounding_mode IN ('half_up', 'floor', 'ceil')),
    grade_bands JSONB DEFAULT '[
        {"grade": "A*", "min_pct": 90, "max_pct": 100, "descriptor": "Outstanding"},
        {"grade": "A", "min_pct": 80, "max_pct": 89.99, "descriptor": "Excellent"},
        {"grade": "B", "min_pct": 70, "max_pct": 79.99, "descriptor": "Very Good"},
        {"grade": "C", "min_pct": 60, "max_pct": 69.99, "descriptor": "Good"},
        {"grade": "D", "min_pct": 50, "max_pct": 59.99, "descriptor": "Satisfactory"},
        {"grade": "E", "min_pct": 40, "max_pct": 49.99, "descriptor": "Marginal"},
        {"grade": "F", "min_pct": 0, "max_pct": 39.99, "descriptor": "Unsatisfactory"}
    ]'::JSONB,
    default_max_marks NUMERIC(5,1) DEFAULT 50.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Classes
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    grade_level TEXT NOT NULL,
    section TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Students
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    roll_number TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_id, roll_number)
);

-- 4. Assessments
CREATE TABLE IF NOT EXISTS public.assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    grade_level TEXT NOT NULL,
    section TEXT NOT NULL,
    max_marks NUMERIC(5,1) NOT NULL CHECK (max_marks > 0),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'processing', 'awaiting_review', 'completed')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    question_paper_path TEXT,
    question_paper_name TEXT,
    marking_scheme_path TEXT,
    marking_scheme_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Assessment Questions & Rubrics
CREATE TABLE IF NOT EXISTS public.assessment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    question_number INT NOT NULL,
    question_text TEXT NOT NULL,
    max_marks NUMERIC(5,1) NOT NULL CHECK (max_marks > 0),
    rubric_criteria JSONB DEFAULT '[]'::JSONB,
    model_answer TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(assessment_id, question_number)
);

-- 6. Student Answer Scripts (Private Storage references)
CREATE TABLE IF NOT EXISTS public.student_scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    page_count INT DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'needs_review', 'graded', 'approved')),
    total_score NUMERIC(5,1),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(assessment_id, student_id)
);

-- 7. Question-Level Grading Results (Preserves AI Proposed vs Teacher Approved)
CREATE TABLE IF NOT EXISTS public.grading_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    script_id UUID NOT NULL REFERENCES public.student_scripts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    proposed_score NUMERIC(5,1) NOT NULL CHECK (proposed_score >= 0),
    approved_score NUMERIC(5,1) CHECK (approved_score >= 0),
    rationale TEXT NOT NULL,
    uncertainty_status TEXT NOT NULL DEFAULT 'high_confidence' CHECK (uncertainty_status IN ('high_confidence', 'medium_confidence', 'high_uncertainty')),
    confidence_score NUMERIC(3,2) NOT NULL DEFAULT 1.00 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    criteria_satisfied JSONB DEFAULT '[]'::JSONB,
    feedback TEXT,
    status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('draft', 'proposed', 'needs_review', 'approved')),
    is_mock BOOLEAN NOT NULL DEFAULT true,
    edited_by_teacher BOOLEAN NOT NULL DEFAULT false,
    answer_extracted_text TEXT,
    script_page_index INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(script_id, question_id)
);

-- 8. Assessment Review & Approval Records
CREATE TABLE IF NOT EXISTS public.assessment_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    approved_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    total_approved_students INT NOT NULL DEFAULT 0,
    average_percentage NUMERIC(5,2)
);

-- Indexes for performant query plans
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON public.classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_teacher ON public.students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assessments_teacher ON public.assessments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assessments_class ON public.assessments(class_id);
CREATE INDEX IF NOT EXISTS idx_questions_assessment ON public.assessment_questions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_scripts_assessment ON public.student_scripts(assessment_id);
CREATE INDEX IF NOT EXISTS idx_scripts_student ON public.student_scripts(student_id);
CREATE INDEX IF NOT EXISTS idx_grading_results_script ON public.grading_results(script_id);
CREATE INDEX IF NOT EXISTS idx_grading_results_assessment ON public.grading_results(assessment_id);

-- Row Level Security (RLS) Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grading_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_approvals ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view and update their own profile
CREATE POLICY "Users can access own profile"
    ON public.profiles FOR ALL
    USING (auth.uid() = id);

-- Classes: Teachers can access only their classes
CREATE POLICY "Teachers can access own classes"
    ON public.classes FOR ALL
    USING (auth.uid() = teacher_id);

-- Students: Teachers can access only their students
CREATE POLICY "Teachers can access own students"
    ON public.students FOR ALL
    USING (auth.uid() = teacher_id);

-- Assessments: Teachers can access only their assessments
CREATE POLICY "Teachers can access own assessments"
    ON public.assessments FOR ALL
    USING (auth.uid() = teacher_id);

-- Assessment Questions: Teachers can access questions for their assessments
CREATE POLICY "Teachers can access own assessment questions"
    ON public.assessment_questions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.assessments a
            WHERE a.id = assessment_questions.assessment_id
            AND a.teacher_id = auth.uid()
        )
    );

-- Student Scripts: Teachers can access scripts for their assessments
CREATE POLICY "Teachers can access own student scripts"
    ON public.student_scripts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.assessments a
            WHERE a.id = student_scripts.assessment_id
            AND a.teacher_id = auth.uid()
        )
    );

-- Grading Results: Teachers can access grading results for their assessments
CREATE POLICY "Teachers can access own grading results"
    ON public.grading_results FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.assessments a
            WHERE a.id = grading_results.assessment_id
            AND a.teacher_id = auth.uid()
        )
    );

-- Assessment Approvals: Teachers can manage own approvals
CREATE POLICY "Teachers can access own approvals"
    ON public.assessment_approvals FOR ALL
    USING (auth.uid() = teacher_id);

-- Private Storage Buckets (Execute via Supabase Dashboard or Migration)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('scripts', 'scripts', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('reference_docs', 'reference_docs', false);
