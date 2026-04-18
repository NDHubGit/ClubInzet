-- Handmatige vrijwilligerstaak: goedkeuring + bron (planned vs manual)

alter table public.tasks add column if not exists approved_by uuid references auth.users (id) on delete set null;
alter table public.tasks add column if not exists approved_at timestamptz;
alter table public.tasks add column if not exists source text default 'planned' not null;

comment on column public.tasks.approved_by is 'Admin die een handmatige taak heeft goedgekeurd';
comment on column public.tasks.approved_at is 'Tijdstip goedkeuring handmatige taak';
comment on column public.tasks.source is 'planned | manual';
comment on column public.tasks.status is 'open | assigned | pending | completed | rejected | no_show';

notify pgrst, 'reload schema';
