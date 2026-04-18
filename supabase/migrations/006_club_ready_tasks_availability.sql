-- Club-ready: taakstatussen, afronding, beschikbaarheidstabel

-- ---- tasks: afronding ----
alter table public.tasks add column if not exists completed_at timestamptz;
alter table public.tasks add column if not exists completed_by uuid references auth.users (id) on delete set null;

comment on column public.tasks.completed_at is 'Wanneer de taak als uitgevoerd is gemeld';
comment on column public.tasks.completed_by is 'Wie de taak als gedaan heeft gemeld';

-- Migreer legacy statussen naar club-model
update public.tasks set status = 'assigned' where status in ('ingepland', 'bevestigd');
update public.tasks set status = 'completed' where status = 'voltooid';

comment on column public.tasks.status is 'open | assigned | completed | no_show';

-- ---- availability ----
create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  available boolean default true not null,
  created_at timestamptz default now() not null,
  unique (user_id, date)
);

create index if not exists availability_user_date_idx on public.availability (user_id, date);

comment on table public.availability is 'Per-datum beschikbaarheid (available=false = niet beschikbaar)';

alter table public.availability enable row level security;

drop policy if exists "availability_select_own" on public.availability;
create policy "availability_select_own"
  on public.availability for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "availability_insert_own" on public.availability;
create policy "availability_insert_own"
  on public.availability for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "availability_update_own" on public.availability;
create policy "availability_update_own"
  on public.availability for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "availability_delete_own" on public.availability;
create policy "availability_delete_own"
  on public.availability for delete to authenticated
  using (auth.uid() = user_id);

-- Ingevulde vrijwilliger mag eigen taakstatus bijwerken (afronden)
drop policy if exists "tasks_update_assignee" on public.tasks;
create policy "tasks_update_assignee"
  on public.tasks for update to authenticated
  using (assigned_to is not null and auth.uid() = assigned_to)
  with check (assigned_to is null or auth.uid() = assigned_to);

comment on column public.profiles.volunteer_type is 'ouder | speler | trainer | vrijwilliger | algemeen (legacy)';

notify pgrst, 'reload schema';
