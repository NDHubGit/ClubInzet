-- Wie een taakrij heeft aangemaakt (o.a. handmatige bijdrage).
alter table public.tasks add column if not exists created_by uuid references auth.users (id) on delete set null;

comment on column public.tasks.created_by is 'auth user die de rij heeft aangemaakt (ingelogde gebruiker bij manual insert)';

notify pgrst, 'reload schema';
