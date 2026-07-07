-- SQL Migration: Bulk Action Transaction untuk Presensi V2
-- Jalankan skrip ini melalui Supabase SQL Editor.

-- Fungsi RPC untuk menyimpan data bulk secara all-or-nothing (Transaction)
-- Menerima array JSON yang berisi detail presensi.
CREATE OR REPLACE FUNCTION public.bulk_upsert_attendance_v2(
  p_records jsonb
)
RETURNS json AS $$
DECLARE
  v_record jsonb;
  v_user_id uuid;
  v_class_id uuid;
  v_student_id uuid;
  v_date date;
  v_status text;
  v_note text;
  v_source text;
  v_expected_updated_at timestamp with time zone;
  v_existing_id uuid;
  v_existing_updated_at timestamp with time zone;
  v_success_count int := 0;
BEGIN
  -- Loop melalui semua elemen dalam array JSON
  FOR v_record IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    v_user_id := (v_record->>'user_id')::uuid;
    v_class_id := (v_record->>'class_id')::uuid;
    v_student_id := (v_record->>'student_id')::uuid;
    v_date := (v_record->>'date')::date;
    v_status := v_record->>'status';
    v_note := v_record->>'note';
    v_source := COALESCE(v_record->>'source', 'bulk_manual');
    
    -- Ambil p_expected_updated_at jika diberikan, format timestamp with time zone
    IF v_record->>'expected_updated_at' IS NOT NULL THEN
      v_expected_updated_at := (v_record->>'expected_updated_at')::timestamp with time zone;
    ELSE
      v_expected_updated_at := NULL;
    END IF;

    -- Cari rekaman yang ada
    SELECT id, updated_at INTO v_existing_id, v_existing_updated_at
    FROM public.attendance_v2_records
    WHERE user_id = v_user_id AND class_id = v_class_id AND student_id = v_student_id AND date = v_date;

    IF v_existing_id IS NOT NULL THEN
      -- Optimistic locking check jika expected_updated_at disediakan
      IF v_expected_updated_at IS NOT NULL AND v_existing_updated_at != v_expected_updated_at THEN
        RAISE EXCEPTION 'Data untuk siswa % pada % telah disunting oleh pengguna lain (Conflict 409)', v_student_id, v_date;
      END IF;

      IF v_status IS NULL OR v_status = '-' THEN
        DELETE FROM public.attendance_v2_records WHERE id = v_existing_id;
      ELSE
        UPDATE public.attendance_v2_records
        SET 
          status = v_status,
          note = COALESCE(v_note, note),
          updated_at = now()
        WHERE id = v_existing_id;
      END IF;
    ELSE
      IF v_status IS NOT NULL AND v_status != '-' THEN
        INSERT INTO public.attendance_v2_records (
          user_id, class_id, student_id, date, status, note, source
        ) VALUES (
          v_user_id, v_class_id, v_student_id, v_date, v_status, v_note, v_source
        );
      END IF;
    END IF;
    
    v_success_count := v_success_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'processed_count', v_success_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
