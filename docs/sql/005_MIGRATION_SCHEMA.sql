-- ============================================
-- SIPENA Database Migration Schema
-- Run this in your external Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. ACADEMIC YEARS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own academic_years" ON public.academic_years
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own academic_years" ON public.academic_years
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own academic_years" ON public.academic_years
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own academic_years" ON public.academic_years
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 2. SEMESTERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.semesters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    number INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own semesters" ON public.semesters
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own semesters" ON public.semesters
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own semesters" ON public.semesters
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own semesters" ON public.semesters
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 3. CLASSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
    semester_id UUID REFERENCES public.semesters(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own classes" ON public.classes
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own classes" ON public.classes
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own classes" ON public.classes
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own classes" ON public.classes
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 4. STUDENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    nisn TEXT NOT NULL,
    is_bookmarked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own students" ON public.students
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own students" ON public.students
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own students" ON public.students
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own students" ON public.students
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 5. SUBJECTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kkm INTEGER DEFAULT 75 NOT NULL,
    is_custom BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subjects" ON public.subjects
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own subjects" ON public.subjects
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own subjects" ON public.subjects
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own subjects" ON public.subjects
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 6. CHAPTERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chapters" ON public.chapters
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own chapters" ON public.chapters
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own chapters" ON public.chapters
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own chapters" ON public.chapters
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 7. ASSIGNMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assignments" ON public.assignments
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own assignments" ON public.assignments
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own assignments" ON public.assignments
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own assignments" ON public.assignments
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 8. GRADES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
    grade_type TEXT NOT NULL,
    value NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own grades" ON public.grades
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own grades" ON public.grades
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own grades" ON public.grades
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own grades" ON public.grades
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 9. GUEST USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.guest_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT,
    phone_number TEXT,
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    totp_enabled BOOLEAN DEFAULT false,
    totp_secret TEXT,
    is_registered BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.guest_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can register as guest" ON public.guest_users
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Guests can view their own record" ON public.guest_users
    FOR SELECT USING (true);
CREATE POLICY "Guests can update their own record" ON public.guest_users
    FOR UPDATE USING (true) WITH CHECK (true);

-- ============================================
-- 10. SHARED LINKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.shared_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    guest_user_id UUID REFERENCES public.guest_users(id) ON DELETE SET NULL,
    token TEXT NOT NULL,
    revoked BOOLEAN DEFAULT false NOT NULL,
    expired_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '1 year') NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create shared links" ON public.shared_links
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own shared links" ON public.shared_links
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can validate token" ON public.shared_links
    FOR SELECT USING (true);
CREATE POLICY "Users can update their own shared links" ON public.shared_links
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Anyone can update shared link usage" ON public.shared_links
    FOR UPDATE USING (revoked = false AND expired_at > now())
    WITH CHECK (revoked = false AND expired_at > now());
CREATE POLICY "Users can delete their own shared links" ON public.shared_links
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 11. GUEST AUDIT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.guest_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shared_link_id UUID NOT NULL REFERENCES public.shared_links(id) ON DELETE CASCADE,
    guest_user_id UUID REFERENCES public.guest_users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.guest_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create audit logs" ON public.guest_audit_logs
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Link owners can view audit logs" ON public.guest_audit_logs
    FOR SELECT USING (
        shared_link_id IN (
            SELECT id FROM public.shared_links WHERE user_id = auth.uid()
        )
    );

-- ============================================
-- 12. NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create notifications" ON public.notifications
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notifications" ON public.notifications
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 13. ACTIVITY LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    entity_name TEXT,
    action TEXT NOT NULL,
    actor_type TEXT DEFAULT 'owner' NOT NULL,
    actor_name TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create activity logs" ON public.activity_logs
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view their own activity logs" ON public.activity_logs
    FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- 14. USER PREFERENCES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    theme_mode TEXT DEFAULT 'light',
    theme_palette TEXT DEFAULT 'default',
    has_completed_onboarding BOOLEAN DEFAULT false,
    onboarding_completed_at TIMESTAMP WITH TIME ZONE,
    email_verified BOOLEAN DEFAULT false,
    phone_number TEXT,
    phone_verified BOOLEAN DEFAULT false,
    totp_enabled BOOLEAN DEFAULT false,
    totp_secret TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own preferences" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own preferences" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own preferences" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- 15. PASSWORD RESET TOKENS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    guest_user_id UUID REFERENCES public.guest_users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    otp_code TEXT,
    method TEXT DEFAULT 'email' NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create reset tokens" ON public.password_reset_tokens
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view valid tokens" ON public.password_reset_tokens
    FOR SELECT USING (expires_at > now() AND used = false);
CREATE POLICY "Anyone can update tokens" ON public.password_reset_tokens
    FOR UPDATE USING (expires_at > now()) WITH CHECK (expires_at > now());

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_academic_years_updated_at BEFORE UPDATE ON public.academic_years
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_semesters_updated_at BEFORE UPDATE ON public.semesters
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON public.subjects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_chapters_updated_at BEFORE UPDATE ON public.chapters
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON public.assignments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_grades_updated_at BEFORE UPDATE ON public.grades
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_guest_users_updated_at BEFORE UPDATE ON public.guest_users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to validate share token
CREATE OR REPLACE FUNCTION public.validate_share_token(p_token TEXT)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    subject_id UUID,
    class_id UUID,
    is_valid BOOLEAN,
    error_message TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sl.id,
        sl.user_id,
        sl.subject_id,
        sl.class_id,
        CASE 
            WHEN sl.id IS NULL THEN false
            WHEN sl.revoked THEN false
            WHEN sl.expired_at < now() THEN false
            ELSE true
        END AS is_valid,
        CASE 
            WHEN sl.id IS NULL THEN 'Token tidak ditemukan'
            WHEN sl.revoked THEN 'Link telah dicabut oleh wali kelas'
            WHEN sl.expired_at < now() THEN 'Link telah kadaluarsa'
            ELSE NULL
        END AS error_message
    FROM public.shared_links sl
    WHERE sl.token = p_token;
END;
$$;

-- Function to check guest access
CREATE OR REPLACE FUNCTION public.guest_has_access_via_shared_link(p_subject_id UUID, p_class_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.shared_links sl
        WHERE sl.subject_id = p_subject_id
          AND sl.class_id = p_class_id
          AND sl.revoked = false
          AND sl.expired_at > now()
    )
$$;

-- Function to check user owns shared link
CREATE OR REPLACE FUNCTION public.user_owns_shared_link(p_user_id UUID, p_subject_id UUID, p_class_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.shared_links sl
        WHERE sl.user_id = p_user_id
          AND sl.subject_id = p_subject_id
          AND sl.class_id = p_class_id
          AND sl.revoked = false
          AND sl.expired_at > now()
    )
$$;

-- Function to delete all user notifications
CREATE OR REPLACE FUNCTION public.delete_all_user_notifications(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    DELETE FROM public.notifications WHERE user_id = p_user_id;
END;
$$;

-- Cleanup old notifications trigger
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    DELETE FROM public.notifications
    WHERE id IN (
        SELECT id FROM public.notifications
        WHERE user_id = NEW.user_id
        ORDER BY created_at DESC
        OFFSET 99
    );
    RETURN NEW;
END;
$$;

-- ============================================
-- STORAGE BUCKET FOR AVATARS
-- ============================================
-- Run this separately in Storage settings or use:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage policies for avatars
-- CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
--     FOR SELECT USING (bucket_id = 'avatars');
-- CREATE POLICY "Users can upload their own avatar" ON storage.objects
--     FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users can update their own avatar" ON storage.objects
--     FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users can delete their own avatar" ON storage.objects
--     FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- ADDITIONAL RLS FOR GUEST ACCESS
-- ============================================

-- Guests can view shared classes
CREATE POLICY "Guests can view shared classes" ON public.classes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.shared_links sl
            WHERE sl.class_id = classes.id
              AND sl.revoked = false
              AND sl.expired_at > now()
        )
    );

-- Guests can view students in shared classes
CREATE POLICY "Guests can view students in shared classes" ON public.students
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.shared_links sl
            WHERE sl.class_id = students.class_id
              AND sl.revoked = false
              AND sl.expired_at > now()
        )
    );

-- Guests can view shared subjects
CREATE POLICY "Guests can view shared subjects" ON public.subjects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.shared_links sl
            WHERE sl.subject_id = subjects.id
              AND sl.revoked = false
              AND sl.expired_at > now()
        )
    );

-- Guests can update shared subjects
CREATE POLICY "Guests can update shared subjects" ON public.subjects
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.shared_links sl
            WHERE sl.subject_id = subjects.id
              AND sl.revoked = false
              AND sl.expired_at > now()
        )
    );

-- Guests can view chapters in shared subjects
CREATE POLICY "Guests can view chapters in shared subjects" ON public.chapters
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.shared_links sl
            WHERE sl.subject_id = chapters.subject_id
              AND sl.revoked = false
              AND sl.expired_at > now()
        )
    );

-- Guests can manage chapters for shared subjects
CREATE POLICY "Guests can insert chapters for shared subjects" ON public.chapters
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.shared_links sl
            WHERE sl.subject_id = chapters.subject_id
              AND sl.revoked = false
              AND sl.expired_at > now()
        )
    );

CREATE POLICY "Guests can update chapters for shared subjects" ON public.chapters
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.shared_links sl
            WHERE sl.subject_id = chapters.subject_id
              AND sl.revoked = false
              AND sl.expired_at > now()
        )
    );

CREATE POLICY "Guests can delete chapters for shared subjects" ON public.chapters
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.shared_links sl
            WHERE sl.subject_id = chapters.subject_id
              AND sl.revoked = false
              AND sl.expired_at > now()
        )
    );

-- Guests can view assignments in shared subjects
CREATE POLICY "Guests can view assignments in shared subjects" ON public.assignments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chapters c
            JOIN public.shared_links sl ON sl.subject_id = c.subject_id
            WHERE c.id = assignments.chapter_id
              AND sl.revoked = false
              AND sl.expired_at > now()
        )
    );

-- Guests can manage assignments for shared subjects
CREATE POLICY "Guests can insert assignments for shared subjects" ON public.assignments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.shared_links sl
            JOIN public.chapters c ON c.subject_id = sl.subject_id
            WHERE c.id = assignments.chapter_id
              AND sl.revoked = false
              AND sl.expired_at > now()
        )
    );

CREATE POLICY "Guests can update assignments for shared subjects" ON public.assignments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.chapters c
            JOIN public.shared_links sl ON sl.subject_id = c.subject_id
            WHERE c.id = assignments.chapter_id
              AND sl.revoked = false
              AND sl.expired_at > now()
        )
    );

CREATE POLICY "Guests can delete assignments for shared subjects" ON public.assignments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.shared_links sl
            JOIN public.chapters c ON c.subject_id = sl.subject_id
            WHERE c.id = assignments.chapter_id
              AND sl.revoked = false
              AND sl.expired_at > now()
        )
    );

-- Guests can view grades in shared subjects
CREATE POLICY "Guests can view grades in shared subjects" ON public.grades
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.shared_links sl
            WHERE sl.subject_id = grades.subject_id
              AND sl.revoked = false
              AND sl.expired_at > now()
        )
    );

-- Guests can manage grades for shared subjects
CREATE POLICY "Guests can insert grades for shared subjects" ON public.grades
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.shared_links sl
            WHERE sl.subject_id = grades.subject_id
              AND sl.revoked = false
              AND sl.expired_at > now()
        )
    );

CREATE POLICY "Guests can update grades for shared subjects" ON public.grades
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.shared_links sl
            WHERE sl.subject_id = grades.subject_id
              AND sl.revoked = false
              AND sl.expired_at > now()
        )
    );

-- ============================================
-- 17. TEAM PROFILES TABLE (for About page)
-- ============================================
CREATE TABLE IF NOT EXISTS public.team_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    description TEXT,
    avatar_url TEXT,
    social_links JSONB DEFAULT '{}'::jsonb,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.team_profiles ENABLE ROW LEVEL SECURITY;

-- Public read access for team profiles
CREATE POLICY "Team profiles are publicly readable" ON public.team_profiles
    FOR SELECT USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_team_profiles_updated_at
    BEFORE UPDATE ON public.team_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial team members
INSERT INTO public.team_profiles (name, role, description, order_index) VALUES
    ('Ali Ridho', 'Founder / Pengembang', 'Pengembang utama SIPENA', 1),
    ('Kana Noviyanti', 'Content Writer / QA & QC Control', 'Guru Sekolah Dasar', 2);

-- ============================================
-- DONE! Your database is ready.
-- ============================================
