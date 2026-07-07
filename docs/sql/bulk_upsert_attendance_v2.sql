-- SQL: Transaksi Bulk Action Presensi V2
-- Fungsi ini akan memproses sekumpulan murid dalam satu waktu secara atomik (100% tersimpan atau rollback semua).
CREATE OR REPLACE FUNCTION public.bulk_upsert_attendance_v2(
  p_user_id uuid,
  p_class_id uuid,
  p_date date,
  p_status text,
  p_student_ids uuid[],
  p_source text DEFAULT 'manual_bulk'
)
RETURNS json AS $$
DECLARE
  v_student_id uuid;
  v_count int := 0;
BEGIN
  -- Loop melalui setiap ID siswa
  FOREACH v_student_id IN ARRAY p_student_ids
  LOOP
    IF p_status IS NULL OR p_status = '-' THEN
      DELETE FROM public.attendance_v2_records 
      WHERE user_id = p_user_id AND class_id = p_class_id AND student_id = v_student_id AND date = p_date;
    ELSE
      INSERT INTO public.attendance_v2_records (
        user_id, class_id, student_id, date, status, source, updated_at
      ) VALUES (
        p_user_id, p_class_id, v_student_id, p_date, p_status, p_source, now()
      ) ON CONFLICT (user_id, class_id, student_id, date)
      DO UPDATE SET 
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at;
        -- (Kolom 'note' dibiarkan utuh tanpa diubah)
    END IF;
    v_count := v_count + 1;
  END LOOP;
  
  RETURN json_build_object('success', true, 'count', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
