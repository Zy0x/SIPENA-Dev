alter table public.user_preferences
  add column if not exists grade_table_color_scheme text default 'classic'::text;

alter table public.user_preferences
  drop constraint if exists user_preferences_grade_table_color_scheme_check;

alter table public.user_preferences
  add constraint user_preferences_grade_table_color_scheme_check
  check (
    grade_table_color_scheme is null
    or grade_table_color_scheme = any (array['classic'::text, 'current'::text, 'future'::text])
  );

update public.user_preferences
set grade_table_color_scheme = 'classic'
where grade_table_color_scheme is null;
