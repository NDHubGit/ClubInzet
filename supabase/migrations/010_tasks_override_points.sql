-- Optionele punt-override door admin (telt boven tasks.points)

alter table public.tasks add column if not exists override_points integer;

comment on column public.tasks.override_points is 'Admin-override voor punten; leeg = gebruik tasks.points';

notify pgrst, 'reload schema';
