# Panduan Setup pg_cron untuk Auto-Delete Expired Account Requests

## Prasyarat

1. Login ke Supabase Dashboard: https://supabase.com/dashboard/project/jdncrsmjvbweyxcbtnou
2. Buka SQL Editor

## Langkah 1: Enable Extensions

Jalankan SQL berikut di SQL Editor untuk mengaktifkan extensions yang diperlukan:

```sql
-- Enable pg_cron extension untuk scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension untuk HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;
```

## Langkah 2: Buat Tabel account_deletion_requests (jika belum ada)

```sql
-- Buat tabel account_deletion_requests
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    user_email TEXT NOT NULL,
    user_name TEXT,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    admin_response TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by TEXT
);

-- Enable Row Level Security
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can create their own deletion requests
CREATE POLICY "Users can create their own deletion requests"
    ON public.account_deletion_requests
    FOR INSERT
    WITH CHECK (true);

-- Policy: Users can view their own deletion requests
CREATE POLICY "Users can view their own deletion requests"
    ON public.account_deletion_requests
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Service role can manage all deletion requests
CREATE POLICY "Service role can manage all deletion requests"
    ON public.account_deletion_requests
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status 
    ON public.account_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_expires 
    ON public.account_deletion_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user 
    ON public.account_deletion_requests(user_id);
```

## Langkah 3: Buat Function untuk Memproses Permintaan Kadaluarsa

```sql
-- Function untuk menghapus data user secara lengkap
CREATE OR REPLACE FUNCTION public.delete_user_data(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB := '{}'::jsonb;
BEGIN
    -- 1. Delete grades
    DELETE FROM public.grades WHERE user_id = p_user_id;
    result := result || jsonb_build_object('grades', true);
    
    -- 2. Delete assignments
    DELETE FROM public.assignments WHERE user_id = p_user_id;
    result := result || jsonb_build_object('assignments', true);
    
    -- 3. Delete chapters
    DELETE FROM public.chapters WHERE user_id = p_user_id;
    result := result || jsonb_build_object('chapters', true);
    
    -- 4. Delete shared_links
    DELETE FROM public.shared_links WHERE user_id = p_user_id;
    result := result || jsonb_build_object('shared_links', true);
    
    -- 5. Delete subjects
    DELETE FROM public.subjects WHERE user_id = p_user_id;
    result := result || jsonb_build_object('subjects', true);
    
    -- 6. Delete students
    DELETE FROM public.students WHERE user_id = p_user_id;
    result := result || jsonb_build_object('students', true);
    
    -- 7. Delete classes
    DELETE FROM public.classes WHERE user_id = p_user_id;
    result := result || jsonb_build_object('classes', true);
    
    -- 8. Delete semesters
    DELETE FROM public.semesters WHERE user_id = p_user_id;
    result := result || jsonb_build_object('semesters', true);
    
    -- 9. Delete academic_years
    DELETE FROM public.academic_years WHERE user_id = p_user_id;
    result := result || jsonb_build_object('academic_years', true);
    
    -- 10. Delete activity_logs
    DELETE FROM public.activity_logs WHERE user_id = p_user_id;
    result := result || jsonb_build_object('activity_logs', true);
    
    -- 11. Delete notifications
    DELETE FROM public.notifications WHERE user_id = p_user_id;
    result := result || jsonb_build_object('notifications', true);
    
    -- 12. Delete user_preferences
    DELETE FROM public.user_preferences WHERE user_id = p_user_id;
    result := result || jsonb_build_object('user_preferences', true);
    
    RETURN result;
END;
$$;

-- Function untuk memproses permintaan kadaluarsa
CREATE OR REPLACE FUNCTION public.process_expired_deletion_requests()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    expired_request RECORD;
    processed_count INT := 0;
    results JSONB := '[]'::jsonb;
    deletion_result JSONB;
BEGIN
    -- Loop through all expired pending requests
    FOR expired_request IN 
        SELECT * FROM public.account_deletion_requests
        WHERE status = 'pending' 
        AND expires_at < now()
    LOOP
        BEGIN
            -- Delete user data
            deletion_result := public.delete_user_data(expired_request.user_id);
            
            -- Update request status
            UPDATE public.account_deletion_requests
            SET 
                status = 'auto_deleted',
                admin_response = 'Otomatis dihapus setelah 24 jam tanpa respons admin',
                processed_at = now(),
                processed_by = 'pg_cron'
            WHERE id = expired_request.id;
            
            processed_count := processed_count + 1;
            
            results := results || jsonb_build_object(
                'request_id', expired_request.id,
                'user_id', expired_request.user_id,
                'success', true,
                'deletion_result', deletion_result
            );
            
        EXCEPTION WHEN OTHERS THEN
            results := results || jsonb_build_object(
                'request_id', expired_request.id,
                'user_id', expired_request.user_id,
                'success', false,
                'error', SQLERRM
            );
        END;
    END LOOP;
    
    RETURN jsonb_build_object(
        'processed_at', now(),
        'processed_count', processed_count,
        'results', results
    );
END;
$$;
```

## Langkah 4: Setup Cron Job

```sql
-- Hapus cron job lama jika ada
SELECT cron.unschedule('process-expired-deletions');

-- Buat cron job baru untuk berjalan setiap jam
SELECT cron.schedule(
    'process-expired-deletions',     -- Nama job
    '0 * * * *',                     -- Setiap jam pada menit ke-0
    $$SELECT public.process_expired_deletion_requests()$$
);
```

### Alternatif: Menggunakan Edge Function via HTTP

Jika Anda ingin menggunakan edge function `process-account-deletion`:

```sql
-- Buat cron job yang memanggil edge function
SELECT cron.schedule(
    'process-expired-deletions-http',
    '0 * * * *',  -- Setiap jam
    $$
    SELECT net.http_post(
        url := 'https://jdncrsmjvbweyxcbtnou.supabase.co/functions/v1/process-account-deletion',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer YOUR_ANON_KEY_HERE'
        ),
        body := jsonb_build_object(
            'action', 'process_expired',
            'adminPassword', 'YOUR_ADMIN_PASSWORD_HERE'
        )
    );
    $$
);
```

**PENTING:** Ganti `YOUR_ANON_KEY_HERE` dan `YOUR_ADMIN_PASSWORD_HERE` dengan nilai sebenarnya!

## Langkah 5: Verifikasi Setup

```sql
-- Lihat daftar cron jobs
SELECT * FROM cron.job;

-- Lihat log eksekusi cron
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- Test function secara manual
SELECT public.process_expired_deletion_requests();
```

## Langkah 6: Monitor dan Maintenance

### Lihat Pending Requests
```sql
SELECT * FROM public.account_deletion_requests 
WHERE status = 'pending' 
ORDER BY created_at DESC;
```

### Lihat Requests yang Sudah Diproses
```sql
SELECT * FROM public.account_deletion_requests 
WHERE status IN ('approved', 'rejected', 'auto_deleted')
ORDER BY processed_at DESC
LIMIT 50;
```

### Lihat Log Cron Job
```sql
SELECT 
    job_id,
    runid,
    start_time,
    end_time,
    status,
    return_message
FROM cron.job_run_details 
WHERE job_id = (SELECT jobid FROM cron.job WHERE jobname = 'process-expired-deletions')
ORDER BY start_time DESC 
LIMIT 10;
```

## Catatan Penting

1. **Backup sebelum menjalankan** - Pastikan Anda memiliki backup database sebelum menjalankan script ini
2. **Test di staging dulu** - Jika memungkinkan, test di environment staging terlebih dahulu
3. **Monitor logs** - Pantau logs cron job secara berkala untuk memastikan tidak ada error
4. **Auth user deletion** - Penghapusan auth.users memerlukan admin API dan harus dilakukan terpisah atau via edge function dengan service_role_key

## Troubleshooting

### Cron job tidak berjalan
```sql
-- Pastikan extension aktif
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Cek status job
SELECT * FROM cron.job;
```

### Function error
```sql
-- Test function dengan user_id tertentu
SELECT public.delete_user_data('your-test-user-id');
```
