-- Add class-level KKM as the source of truth for overall class ranking thresholds.
alter table public.classes
add column if not exists class_kkm integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'classes_class_kkm_check'
  ) then
    alter table public.classes
    add constraint classes_class_kkm_check
    check (class_kkm is null or (class_kkm >= 0 and class_kkm <= 100));
  end if;
end $$;

comment on column public.classes.class_kkm is
'KKM kelas untuk acuan ranking keseluruhan dan default KKM mapel baru.';

create or replace function public.set_subject_kkm_from_class_default()
returns trigger
language plpgsql
as $$
declare
  resolved_class_kkm integer;
begin
  if new.kkm is null then
    select class_kkm
    into resolved_class_kkm
    from public.classes
    where id = new.class_id;

    new.kkm := coalesce(resolved_class_kkm, 70);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_subjects_default_kkm_from_class on public.subjects;

create trigger trg_subjects_default_kkm_from_class
before insert on public.subjects
for each row
execute function public.set_subject_kkm_from_class_default();
