-- ============================================================================
-- 015_OCR_IMPORTS_AUDIT_TRAIL.sql
-- Skrip untuk membuat tabel log audit OCR dan bucket penyimpanan foto terkompresi.
-- ============================================================================

-- 1. Buat tabel public.ocr_imports
CREATE TABLE IF NOT EXISTS public.ocr_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    kind VARCHAR(50) NOT NULL, -- 'students', 'grades', 'attendance'
    image_path VARCHAR(255),   -- path file di storage bucket ocr-imports
    records_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Aktifkan Row Level Security (RLS)
ALTER TABLE public.ocr_imports ENABLE ROW LEVEL SECURITY;

-- 3. Hapus policy lama jika ada
DROP POLICY IF EXISTS "Users can view their own ocr imports" ON public.ocr_imports;
DROP POLICY IF EXISTS "Users can create their own ocr imports" ON public.ocr_imports;

-- 4. Buat policy akses berbasis user_id
CREATE POLICY "Users can view their own ocr imports" ON public.ocr_imports
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own ocr imports" ON public.ocr_imports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Index untuk performa pencarian log
CREATE INDEX IF NOT EXISTS idx_ocr_imports_user_id ON public.ocr_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_ocr_imports_class_id ON public.ocr_imports(class_id);

-- ============================================================================
-- STORAGE: Bucket untuk mengarsipkan foto tabel hasil OCR terkompresi
-- ============================================================================

-- 6. Buat bucket 'ocr-imports' (private demi privasi nilai murid)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ocr-imports', 'ocr-imports', false)
ON CONFLICT (id) DO NOTHING;

-- 7. Hapus policy lama jika ada
DROP POLICY IF EXISTS "Users can view their own ocr files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own ocr files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own ocr files" ON storage.objects;

-- 8. Storage policies berbasis owner autentikasi (menggunakan path folder user_id)
CREATE POLICY "Users can view their own ocr files" ON storage.objects
    FOR SELECT USING (bucket_id = 'ocr-imports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own ocr files" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'ocr-imports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own ocr files" ON storage.objects
    FOR DELETE USING (bucket_id = 'ocr-imports' AND auth.uid()::text = (storage.foldername(name))[1]);
