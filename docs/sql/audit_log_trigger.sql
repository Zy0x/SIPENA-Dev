-- SQL: Trigger untuk Audit Log Presensi V2
-- Menambahkan trigger otomatis untuk mencatat insert, update, dan delete di tabel attendance_v2_records.

CREATE OR REPLACE FUNCTION public.trigger_attendance_v2_audit()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.attendance_v2_audit_logs (class_id, student_id, record_id, action, new_state)
    VALUES (NEW.class_id, NEW.student_id, NEW.id, 'inserted', row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status OR OLD.note IS DISTINCT FROM NEW.note THEN
      INSERT INTO public.attendance_v2_audit_logs (class_id, student_id, record_id, action, previous_state, new_state)
      VALUES (NEW.class_id, NEW.student_id, NEW.id, 'updated', row_to_json(OLD), row_to_json(NEW));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.attendance_v2_audit_logs (class_id, student_id, record_id, action, previous_state)
    VALUES (OLD.class_id, OLD.student_id, OLD.id, 'deleted', row_to_json(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_attendance_v2_changes ON public.attendance_v2_records;
CREATE TRIGGER audit_attendance_v2_changes
AFTER INSERT OR UPDATE OR DELETE ON public.attendance_v2_records
FOR EACH ROW
EXECUTE FUNCTION public.trigger_attendance_v2_audit();
