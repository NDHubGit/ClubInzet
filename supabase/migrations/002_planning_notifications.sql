-- Planning: assigned_to, notification_sent, task_date, title, team_id
-- Teams-tabel optioneel. Draai in Supabase SQL Editor.

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

alter table public.tasks add column if not exists team_id uuid references public.teams (id) on delete set null;
alter table public.tasks add column if not exists assigned_to uuid references auth.users (id) on delete set null;
alter table public.tasks add column if not exists notification_sent boolean default false not null;
alter table public.tasks add column if not exists task_date date;
alter table public.tasks add column if not exists title text;

-- Profielen: rol voor “admin krijgt minder taken” (optioneel)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    alter table public.profiles add column if not exists role text default 'member';
  end if;
end $$;

alter table public.teams enable row level security;
drop policy if exists "teams_read" on public.teams;
create policy "teams_read"
  on public.teams for select to authenticated using (true);

-- Alleen eigen taken bijwerken (planning-pool: user_id = degene die de planning draait)
drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own"
  on public.tasks for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
