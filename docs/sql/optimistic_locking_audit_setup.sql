-- SQL Migration: Optimistic Locking & Audit Delegation
-- Jalankan skrip ini melalui Supabase SQL Editor.

-- 1. Tambahkan kolom updated_at (jika belum ada) ke tabel attendance_v2_records
ALTER TABLE public.attendance_v2_records
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 2. Buat fungsi trigger untuk auto-update updated_at jika belum ada (opsional, tapi baik untuk konsistensi)
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_attendance_updated_at ON public.attendance_v2_records;
CREATE TRIGGER set_attendance_updated_at
BEFORE UPDATE ON public.attendance_v2_records
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 3. Buat tabel attendance_v2_audit_logs jika belum ada
CREATE TABLE IF NOT EXISTS public.attendance_v2_audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    record_id uuid REFERENCES public.attendance_v2_records(id) ON DELETE SET NULL,
    action text NOT NULL, -- 'inserted', 'updated', 'deleted', 'restored_snapshot'
    before_data jsonb,
    after_data jsonb,
    created_at timestamp with time zone DEFAULT now(),
    delegated_from uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index untuk mempercepat query audit log berdasarkan class_id dan waktu
CREATE INDEX IF NOT EXISTS idx_attendance_v2_audit_logs_class_id ON public.attendance_v2_audit_logs(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_v2_audit_logs_created_at ON public.attendance_v2_audit_logs(created_at DESC);

-- Aktifkan RLS
ALTER TABLE public.attendance_v2_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy (Siapa saja yang bisa melihat logs? Misal admin/guru kelas)
-- Sesuaikan dengan policy sekolah Anda. Contoh default: Semua guru dapat melihat logs kelasnya.
CREATE POLICY "Users can view audit logs for their classes" ON public.attendance_v2_audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = attendance_v2_audit_logs.class_id AND c.user_id = auth.uid()
    )
  );

-- Policy untuk insert (Insert logs bisa dilakukan oleh owner dan sistem)
CREATE POLICY "Users can insert audit logs for their classes" ON public.attendance_v2_audit_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = attendance_v2_audit_logs.class_id AND c.user_id = auth.uid()
    )
  );


-- 4. RPC untuk melakukan Optimistic Locking saat update presensi
CREATE OR REPLACE FUNCTION public.upsert_attendance_v2_optimistic(
  p_user_id uuid,
  p_student_id uuid,
  p_date date,
  p_class_id uuid,
  p_status text,
  p_note text,
  p_expected_updated_at timestamp with time zone,
  p_source text,
  p_delegated_from uuid DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_updated_at timestamp with time zone;
  v_existing_id uuid;
  v_existing_updated_at timestamp with time zone;
BEGIN
  -- Cek apakah data ada
  SELECT id, updated_at INTO v_existing_id, v_existing_updated_at
  FROM public.attendance_v2_records
  WHERE user_id = p_user_id AND class_id = p_class_id AND student_id = p_student_id AND date = p_date;

  IF v_existing_id IS NOT NULL THEN
    -- Update path dengan optimistic locking
    IF p_expected_updated_at IS NOT NULL AND v_existing_updated_at != p_expected_updated_at THEN
      RAISE EXCEPTION 'Data telah disunting oleh pengguna lain (Conflict 409)';
    END IF;

    IF p_status IS NULL OR p_status = '-' THEN
      DELETE FROM public.attendance_v2_records WHERE id = v_existing_id;
      RETURN json_build_object('success', true, 'action', 'deleted');
    ELSE
      UPDATE public.attendance_v2_records
      SET 
        status = p_status,
        note = p_note,
        updated_at = now()
      WHERE id = v_existing_id
      RETURNING updated_at INTO v_updated_at;
      RETURN json_build_object('success', true, 'action', 'updated', 'updated_at', v_updated_at);
    END IF;
  ELSE
    -- Insert path
    IF p_status IS NULL OR p_status = '-' THEN
      RETURN json_build_object('success', true, 'action', 'ignored');
    END IF;

    INSERT INTO public.attendance_v2_records (
      user_id, class_id, student_id, date, status, note, source
    ) VALUES (
      p_user_id, p_class_id, p_student_id, p_date, p_status, p_note, p_source
    ) RETURNING updated_at INTO v_updated_at;
    
    RETURN json_build_object('success', true, 'action', 'inserted', 'updated_at', v_updated_at);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
