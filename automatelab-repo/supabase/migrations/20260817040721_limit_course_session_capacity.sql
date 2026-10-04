alter table public.course_sessions
  alter column capacity set default 10;

alter table public.course_sessions
  drop constraint if exists course_sessions_capacity_check;

alter table public.course_sessions
  add constraint course_sessions_capacity_check
  check (capacity between 1 and 10);
