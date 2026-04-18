-- ClubInzet: ontbrekende tabel `public.tasks` (fout: "Could not find the table public.tasks")
-- Supabase → SQL Editor → New query → plak dit script → Run
-- Veilig meerdere keren draaien (IF NOT EXISTS + DROP POLICY IF EXISTS).

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_type text not null,
  duration_minutes numeric not null,
  points numeric not null,
  flagged boolean default false not null,
  flag_reason text,
  created_at timestamptz default now() not null
);

create index if not exists tasks_user_id_created_at_idx
  on public.tasks (user_id, created_at desc);

alter table public.tasks enable row level security;

drop policy if exists "tasks_read" on public.tasks;
drop policy if exists "tasks_insert_own" on public.tasks;

-- Klassement: alle ingelogde gebruikers mogen punten/user_id lezen
create policy "tasks_read"
  on public.tasks
  for select
  to authenticated
  using (true);

-- Alleen eigen taken invoeren
create policy "tasks_insert_own"
  on public.tasks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
