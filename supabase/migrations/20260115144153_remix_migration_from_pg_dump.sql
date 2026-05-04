CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: cleanup_old_notifications(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_notifications() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Delete oldest notifications beyond 99 for the user
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


--
-- Name: delete_all_user_notifications(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_all_user_notifications(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.notifications WHERE user_id = p_user_id;
END;
$$;


--
-- Name: guest_has_access_via_shared_link(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guest_has_access_via_shared_link(p_subject_id uuid, p_class_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.shared_links sl
    WHERE sl.subject_id = p_subject_id
      AND sl.class_id = p_class_id
      AND sl.revoked = false
      AND sl.expired_at > now()
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: user_owns_shared_link(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_owns_shared_link(p_user_id uuid, p_subject_id uuid, p_class_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.shared_links sl
    WHERE sl.user_id = p_user_id
      AND sl.subject_id = p_subject_id
      AND sl.class_id = p_class_id
      AND sl.revoked = false
      AND sl.expired_at > now()
  )
$$;


--
-- Name: validate_share_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_share_token(p_token text) RETURNS TABLE(id uuid, user_id uuid, subject_id uuid, class_id uuid, is_valid boolean, error_message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


SET default_table_access_method = heap;

--
-- Name: academic_years; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.academic_years (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    actor_type text DEFAULT 'owner'::text NOT NULL,
    actor_name text,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    entity_name text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    chapter_id uuid NOT NULL,
    name text NOT NULL,
    order_index integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.assignments REPLICA IDENTITY FULL;


--
-- Name: chapters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chapters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    name text NOT NULL,
    order_index integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.chapters REPLICA IDENTITY FULL;


--
-- Name: classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    academic_year_id uuid,
    semester_id uuid,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: grades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    student_id uuid NOT NULL,
    assignment_id uuid,
    subject_id uuid NOT NULL,
    grade_type text NOT NULL,
    value numeric(5,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT grades_grade_type_check CHECK ((grade_type = ANY (ARRAY['assignment'::text, 'sts'::text, 'sas'::text]))),
    CONSTRAINT grades_value_check CHECK (((value >= (0)::numeric) AND (value <= (100)::numeric)))
);


--
-- Name: guest_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guest_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shared_link_id uuid NOT NULL,
    guest_user_id uuid,
    action text NOT NULL,
    details jsonb,
    ip_address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: guest_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guest_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    password_hash text,
    phone_number text,
    phone_verified boolean DEFAULT false,
    email_verified boolean DEFAULT false,
    totp_secret text,
    totp_enabled boolean DEFAULT false,
    is_registered boolean DEFAULT false
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    guest_user_id uuid,
    token text NOT NULL,
    otp_code text,
    method text DEFAULT 'email'::text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_or_guest CHECK (((user_id IS NOT NULL) OR (guest_user_id IS NOT NULL)))
);


--
-- Name: semesters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.semesters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    academic_year_id uuid NOT NULL,
    name text NOT NULL,
    number integer NOT NULL,
    is_active boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT semesters_number_check CHECK ((number = ANY (ARRAY[1, 2])))
);


--
-- Name: shared_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shared_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    class_id uuid NOT NULL,
    token text NOT NULL,
    guest_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expired_at timestamp with time zone DEFAULT (now() + '1 year'::interval) NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.students (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    class_id uuid NOT NULL,
    name text NOT NULL,
    nisn text NOT NULL,
    is_bookmarked boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subjects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subjects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    class_id uuid NOT NULL,
    name text NOT NULL,
    kkm integer DEFAULT 75 NOT NULL,
    is_custom boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subjects_kkm_check CHECK (((kkm >= 0) AND (kkm <= 100)))
);


--
-- Name: user_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    theme_mode text DEFAULT 'light'::text,
    theme_palette text DEFAULT 'default'::text,
    has_completed_onboarding boolean DEFAULT false,
    onboarding_completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    phone_number text,
    phone_verified boolean DEFAULT false,
    email_verified boolean DEFAULT false,
    totp_secret text,
    totp_enabled boolean DEFAULT false,
    CONSTRAINT user_preferences_theme_mode_check CHECK ((theme_mode = ANY (ARRAY['light'::text, 'dark'::text])))
);


--
-- Name: academic_years academic_years_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academic_years
    ADD CONSTRAINT academic_years_pkey PRIMARY KEY (id);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: assignments assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_pkey PRIMARY KEY (id);


--
-- Name: chapters chapters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_pkey PRIMARY KEY (id);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: grades grades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT grades_pkey PRIMARY KEY (id);


--
-- Name: guest_audit_logs guest_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_audit_logs
    ADD CONSTRAINT guest_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: guest_users guest_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_users
    ADD CONSTRAINT guest_users_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- Name: semesters semesters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semesters
    ADD CONSTRAINT semesters_pkey PRIMARY KEY (id);


--
-- Name: shared_links shared_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_links
    ADD CONSTRAINT shared_links_pkey PRIMARY KEY (id);


--
-- Name: shared_links shared_links_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_links
    ADD CONSTRAINT shared_links_token_key UNIQUE (token);


--
-- Name: shared_links shared_links_user_id_subject_id_class_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_links
    ADD CONSTRAINT shared_links_user_id_subject_id_class_id_key UNIQUE (user_id, subject_id, class_id);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_preferences user_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_key UNIQUE (user_id);


--
-- Name: idx_activity_logs_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_user_created ON public.activity_logs USING btree (user_id, created_at DESC);


--
-- Name: idx_assignments_chapter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_chapter ON public.assignments USING btree (chapter_id);


--
-- Name: idx_chapters_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapters_subject ON public.chapters USING btree (subject_id);


--
-- Name: idx_classes_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classes_user ON public.classes USING btree (user_id);


--
-- Name: idx_grades_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grades_assignment ON public.grades USING btree (assignment_id);


--
-- Name: idx_grades_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grades_student ON public.grades USING btree (student_id);


--
-- Name: idx_grades_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grades_subject ON public.grades USING btree (subject_id);


--
-- Name: idx_guest_audit_logs_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_guest_audit_logs_link ON public.guest_audit_logs USING btree (shared_link_id);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, read) WHERE (read = false);


--
-- Name: idx_semesters_academic_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_semesters_academic_year ON public.semesters USING btree (academic_year_id);


--
-- Name: idx_shared_links_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shared_links_token ON public.shared_links USING btree (token);


--
-- Name: idx_shared_links_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shared_links_user ON public.shared_links USING btree (user_id);


--
-- Name: idx_students_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_class ON public.students USING btree (class_id);


--
-- Name: idx_subjects_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subjects_class ON public.subjects USING btree (class_id);


--
-- Name: notifications cleanup_notifications_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cleanup_notifications_trigger AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.cleanup_old_notifications();


--
-- Name: academic_years update_academic_years_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_academic_years_updated_at BEFORE UPDATE ON public.academic_years FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: assignments update_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: chapters update_chapters_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_chapters_updated_at BEFORE UPDATE ON public.chapters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: classes update_classes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: grades update_grades_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_grades_updated_at BEFORE UPDATE ON public.grades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: guest_users update_guest_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_guest_users_updated_at BEFORE UPDATE ON public.guest_users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: semesters update_semesters_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_semesters_updated_at BEFORE UPDATE ON public.semesters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: students update_students_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subjects update_subjects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_preferences update_user_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: assignments assignments_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE;


--
-- Name: chapters chapters_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: classes classes_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL;


--
-- Name: classes classes_semester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES public.semesters(id) ON DELETE SET NULL;


--
-- Name: grades grades_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT grades_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;


--
-- Name: grades grades_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT grades_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: grades grades_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT grades_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: guest_audit_logs guest_audit_logs_guest_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_audit_logs
    ADD CONSTRAINT guest_audit_logs_guest_user_id_fkey FOREIGN KEY (guest_user_id) REFERENCES public.guest_users(id) ON DELETE SET NULL;


--
-- Name: guest_audit_logs guest_audit_logs_shared_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_audit_logs
    ADD CONSTRAINT guest_audit_logs_shared_link_id_fkey FOREIGN KEY (shared_link_id) REFERENCES public.shared_links(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_guest_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_guest_user_id_fkey FOREIGN KEY (guest_user_id) REFERENCES public.guest_users(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: semesters semesters_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semesters
    ADD CONSTRAINT semesters_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE CASCADE;


--
-- Name: shared_links shared_links_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_links
    ADD CONSTRAINT shared_links_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: shared_links shared_links_guest_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_links
    ADD CONSTRAINT shared_links_guest_user_id_fkey FOREIGN KEY (guest_user_id) REFERENCES public.guest_users(id) ON DELETE SET NULL;


--
-- Name: shared_links shared_links_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_links
    ADD CONSTRAINT shared_links_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: shared_links shared_links_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_links
    ADD CONSTRAINT shared_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: students students_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: subjects subjects_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: activity_logs Anyone can create activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create activity logs" ON public.activity_logs FOR INSERT WITH CHECK (true);


--
-- Name: guest_audit_logs Anyone can create audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create audit logs" ON public.guest_audit_logs FOR INSERT WITH CHECK (true);


--
-- Name: notifications Anyone can create notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);


--
-- Name: password_reset_tokens Anyone can create reset tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create reset tokens" ON public.password_reset_tokens FOR INSERT WITH CHECK (true);


--
-- Name: guest_users Anyone can register as guest; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can register as guest" ON public.guest_users FOR INSERT WITH CHECK (true);


--
-- Name: shared_links Anyone can update shared link usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update shared link usage" ON public.shared_links FOR UPDATE USING (((revoked = false) AND (expired_at > now()))) WITH CHECK (((revoked = false) AND (expired_at > now())));


--
-- Name: password_reset_tokens Anyone can update tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update tokens" ON public.password_reset_tokens FOR UPDATE USING ((expires_at > now())) WITH CHECK ((expires_at > now()));


--
-- Name: shared_links Anyone can validate token; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can validate token" ON public.shared_links FOR SELECT USING (true);


--
-- Name: password_reset_tokens Anyone can view valid tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view valid tokens" ON public.password_reset_tokens FOR SELECT USING (((expires_at > now()) AND (used = false)));


--
-- Name: assignments Guests can create assignments for shared subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can create assignments for shared subjects" ON public.assignments FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.chapters c
     JOIN public.shared_links sl ON ((sl.subject_id = c.subject_id)))
  WHERE ((c.id = assignments.chapter_id) AND (sl.user_id = assignments.user_id) AND (sl.revoked = false) AND (sl.expired_at > now())))));


--
-- Name: chapters Guests can create chapters for shared subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can create chapters for shared subjects" ON public.chapters FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.shared_links sl
  WHERE ((sl.subject_id = sl.subject_id) AND (sl.user_id = chapters.user_id) AND (sl.revoked = false) AND (sl.expired_at > now())))));


--
-- Name: assignments Guests can delete assignments for shared subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can delete assignments for shared subjects" ON public.assignments FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.shared_links sl
     JOIN public.chapters c ON ((c.subject_id = sl.subject_id)))
  WHERE ((c.id = assignments.chapter_id) AND (sl.revoked = false) AND (sl.expired_at > now())))));


--
-- Name: chapters Guests can delete chapters for shared subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can delete chapters for shared subjects" ON public.chapters FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.shared_links sl
  WHERE ((sl.subject_id = chapters.subject_id) AND (sl.revoked = false) AND (sl.expired_at > now())))));


--
-- Name: assignments Guests can insert assignments for shared subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can insert assignments for shared subjects" ON public.assignments FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.shared_links sl
     JOIN public.chapters c ON ((c.subject_id = sl.subject_id)))
  WHERE ((c.id = assignments.chapter_id) AND (sl.revoked = false) AND (sl.expired_at > now())))));


--
-- Name: chapters Guests can insert chapters for shared subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can insert chapters for shared subjects" ON public.chapters FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.shared_links sl
  WHERE ((sl.subject_id = chapters.subject_id) AND (sl.revoked = false) AND (sl.expired_at > now())))));


--
-- Name: grades Guests can insert grades for shared subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can insert grades for shared subjects" ON public.grades FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.shared_links sl
  WHERE ((sl.subject_id = grades.subject_id) AND (sl.revoked = false) AND (sl.expired_at > now())))));


--
-- Name: assignments Guests can update assignments for shared subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can update assignments for shared subjects" ON public.assignments FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.chapters c
     JOIN public.shared_links sl ON ((sl.subject_id = c.subject_id)))
  WHERE ((c.id = assignments.chapter_id) AND (sl.revoked = false) AND (sl.expired_at > now())))));


--
-- Name: chapters Guests can update chapters for shared subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can update chapters for shared subjects" ON public.chapters FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.shared_links sl
  WHERE ((sl.subject_id = chapters.subject_id) AND (sl.revoked = false) AND (sl.expired_at > now())))));


--
-- Name: grades Guests can update grades for shared subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can update grades for shared subjects" ON public.grades FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.shared_links sl
  WHERE ((sl.subject_id = grades.subject_id) AND (sl.revoked = false) AND (sl.expired_at > now())))));


--
-- Name: subjects Guests can update shared subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can update shared subjects" ON public.subjects FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.shared_links sl
  WHERE ((sl.subject_id = subjects.id) AND (sl.revoked = false) AND (sl.expired_at > now())))));


--
-- Name: guest_users Guests can update their own record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can update their own record" ON public.guest_users FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: assignments Guests can view assignments in shared subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can view assignments in shared subjects" ON public.assignments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.chapters c
     JOIN public.shared_links sl ON ((sl.subject_id = c.subject_id)))
  WHERE ((c.id = assignments.chapter_id) AND (sl.revoked = false) AND (sl.expired_at > now())))));


--
-- Name: chapters Guests can view chapters in shared subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can view chapters in shared subjects" ON public.chapters FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.shared_links sl
  WHERE ((sl.subject_id = chapters.subject_id) AND (sl.revoked = false) AND (sl.expired_at > now())))));


--
-- Name: grades Guests can view grades in shared subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can view grades in shared subjects" ON public.grades FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.shared_links sl
  WHERE ((sl.subject_id = grades.subject_id) AND (sl.revoked = false) AND (sl.expired_at > now())))));


--
-- Name: classes Guests can view shared classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can view shared classes" ON public.classes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.shared_links sl
  WHERE ((sl.class_id = classes.id) AND (sl.revoked = false) AND (sl.expired_at > now())))));


--
-- Name: subjects Guests can view shared subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can view shared subjects" ON public.subjects FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.shared_links sl
  WHERE ((sl.subject_id = subjects.id) AND (sl.revoked = false) AND (sl.expired_at > now())))));


--
-- Name: students Guests can view students in shared classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can view students in shared classes" ON public.students FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.shared_links sl
  WHERE ((sl.class_id = students.class_id) AND (sl.revoked = false) AND (sl.expired_at > now())))));


--
-- Name: guest_users Guests can view their own record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can view their own record" ON public.guest_users FOR SELECT USING (true);


--
-- Name: guest_audit_logs Link owners can view audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Link owners can view audit logs" ON public.guest_audit_logs FOR SELECT USING ((shared_link_id IN ( SELECT shared_links.id
   FROM public.shared_links
  WHERE (shared_links.user_id = auth.uid()))));


--
-- Name: shared_links Users can create shared links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create shared links" ON public.shared_links FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: academic_years Users can create their own academic_years; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own academic_years" ON public.academic_years FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: assignments Users can create their own assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own assignments" ON public.assignments FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: chapters Users can create their own chapters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own chapters" ON public.chapters FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: classes Users can create their own classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own classes" ON public.classes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: grades Users can create their own grades; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own grades" ON public.grades FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: semesters Users can create their own semesters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own semesters" ON public.semesters FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: students Users can create their own students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own students" ON public.students FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: subjects Users can create their own subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own subjects" ON public.subjects FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: academic_years Users can delete their own academic_years; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own academic_years" ON public.academic_years FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: assignments Users can delete their own assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own assignments" ON public.assignments FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: chapters Users can delete their own chapters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own chapters" ON public.chapters FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: classes Users can delete their own classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own classes" ON public.classes FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: grades Users can delete their own grades; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own grades" ON public.grades FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: notifications Users can delete their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: semesters Users can delete their own semesters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own semesters" ON public.semesters FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: shared_links Users can delete their own shared links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own shared links" ON public.shared_links FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: students Users can delete their own students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own students" ON public.students FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: subjects Users can delete their own subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own subjects" ON public.subjects FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_preferences Users can insert their own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own preferences" ON public.user_preferences FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: academic_years Users can update their own academic_years; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own academic_years" ON public.academic_years FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: assignments Users can update their own assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own assignments" ON public.assignments FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: chapters Users can update their own chapters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own chapters" ON public.chapters FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: classes Users can update their own classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own classes" ON public.classes FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: grades Users can update their own grades; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own grades" ON public.grades FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: notifications Users can update their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_preferences Users can update their own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own preferences" ON public.user_preferences FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: semesters Users can update their own semesters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own semesters" ON public.semesters FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: shared_links Users can update their own shared links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own shared links" ON public.shared_links FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: students Users can update their own students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own students" ON public.students FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: subjects Users can update their own subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own subjects" ON public.subjects FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: academic_years Users can view their own academic_years; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own academic_years" ON public.academic_years FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: activity_logs Users can view their own activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own activity logs" ON public.activity_logs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: assignments Users can view their own assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own assignments" ON public.assignments FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: chapters Users can view their own chapters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own chapters" ON public.chapters FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: classes Users can view their own classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own classes" ON public.classes FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: grades Users can view their own grades; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own grades" ON public.grades FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notifications Users can view their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_preferences Users can view their own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own preferences" ON public.user_preferences FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: semesters Users can view their own semesters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own semesters" ON public.semesters FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: shared_links Users can view their own shared links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own shared links" ON public.shared_links FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: students Users can view their own students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own students" ON public.students FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: subjects Users can view their own subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own subjects" ON public.subjects FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: academic_years; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: chapters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

--
-- Name: classes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

--
-- Name: grades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

--
-- Name: guest_audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.guest_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: guest_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.guest_users ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: password_reset_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: semesters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;

--
-- Name: shared_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

--
-- Name: students; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

--
-- Name: subjects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

--
-- Name: user_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;