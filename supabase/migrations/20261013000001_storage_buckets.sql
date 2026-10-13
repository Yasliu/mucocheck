-- ============================================================================
-- MucoCheck: Private Storage Buckets & Policies Migration
-- ============================================================================
-- NOTE: In Supabase, storage.objects is owned by supabase_storage_admin and
-- already has Row Level Security enabled by default. Do NOT run
-- 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;' as that causes:
-- ERROR: 42501: must be owner of table objects.
-- ============================================================================

-- 1. Create or update private buckets for answer scripts and reference docs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'scripts',
    'scripts',
    false,
    52428800, -- 50 MB limit
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'reference_docs',
    'reference_docs',
    false,
    52428800, -- 50 MB limit
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- 2. Policy: Authenticated teachers can upload into their own teacher directory
DROP POLICY IF EXISTS "Teacher storage upload" ON storage.objects;
CREATE POLICY "Teacher storage upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('scripts', 'reference_docs') AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Policy: Authenticated teachers can read files from their own teacher directory
DROP POLICY IF EXISTS "Teacher storage read" ON storage.objects;
CREATE POLICY "Teacher storage read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id IN ('scripts', 'reference_docs') AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Policy: Authenticated teachers can update/delete files in their own teacher directory
DROP POLICY IF EXISTS "Teacher storage update" ON storage.objects;
CREATE POLICY "Teacher storage update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('scripts', 'reference_docs') AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Teacher storage delete" ON storage.objects;
CREATE POLICY "Teacher storage delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('scripts', 'reference_docs') AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
